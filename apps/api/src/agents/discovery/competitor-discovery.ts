/**
 * Competitor Discovery Agent
 *
 * Discovers competing domains that appear in search results
 * for the target queries. These are the sites currently
 * winning visibility for queries the target page should answer.
 */

import { Langfuse } from 'langfuse';
import { type TargetQuery, type CompetitorVisibility, type TavilySearchResult } from '../../types';
import { searchBatch } from '../../lib/tavily';

// ===================
// Configuration
// ===================

const MAX_COMPETITORS = 10;
const MIN_APPEARANCES = 2; // Minimum query appearances to be considered a competitor

// ===================
// Client Initialization
// ===================

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  secretKey: process.env.LANGFUSE_SECRET_KEY || '',
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
});

// ===================
// Types
// ===================

interface DomainStats {
  domain: string;
  appearances: number;
  totalRank: number;
  queries: string[];
  urls: Set<string>;
}

// ===================
// Main Function
// ===================

/**
 * Discover competing domains based on target queries
 */
export async function discoverCompetitors(
  queries: TargetQuery[],
  targetDomain: string,
  tenantId: string,
  jobId: string,
  options: {
    maxCompetitors?: number;
    searchResults?: TavilySearchResult[]; // Reuse if already searched
  } = {}
): Promise<CompetitorVisibility[]> {
  const { maxCompetitors = MAX_COMPETITORS, searchResults } = options;

  const trace = langfuse.trace({
    name: 'aeo-competitor-discovery',
    userId: tenantId,
    metadata: { jobId, targetDomain, queryCount: queries.length },
  });

  const span = trace.span({
    name: 'discover-competitors',
  });

  try {
    // Get search results (reuse if provided, otherwise fetch)
    const results = searchResults || await searchBatch(
      queries.map(q => q.query),
      {
        maxResults: 10,
        searchDepth: 'basic',
      }
    );

    // Analyze domain frequency across all results
    const domainStats = analyzeDomainStats(results, targetDomain);

    // Convert to CompetitorVisibility format
    const competitors = buildCompetitorList(
      domainStats,
      results,
      queries.length,
      maxCompetitors
    );

    span.end({
      output: {
        competitorsFound: competitors.length,
        topCompetitor: competitors[0]?.domain,
      },
    });

    await langfuse.flushAsync();

    return competitors;
  } catch (error) {
    span.end({
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await langfuse.flushAsync();
    throw error;
  }
}

/**
 * Get quick competitor overview without full analysis
 */
export async function getTopCompetitors(
  queries: string[],
  targetDomain: string,
  limit = 5
): Promise<string[]> {
  const results = await searchBatch(queries.slice(0, 5), {
    maxResults: 5,
    searchDepth: 'basic',
  });

  const domainCounts = new Map<string, number>();

  for (const result of results) {
    for (const item of result.results) {
      const domain = item.domain;
      if (domain !== targetDomain && !domain.includes(targetDomain)) {
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      }
    }
  }

  // Sort by count and return top domains
  return [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain]) => domain);
}

// ===================
// Helper Functions
// ===================

/**
 * Analyze domain statistics from search results
 */
function analyzeDomainStats(
  results: TavilySearchResult[],
  targetDomain: string
): Map<string, DomainStats> {
  const stats = new Map<string, DomainStats>();

  for (const result of results) {
    for (let i = 0; i < result.results.length; i++) {
      const item = result.results[i];
      if (!item) continue;
      const domain = item.domain;

      // Skip target domain
      if (domain === targetDomain || domain.includes(targetDomain) || targetDomain.includes(domain)) {
        continue;
      }

      // Initialize or update stats
      if (!stats.has(domain)) {
        stats.set(domain, {
          domain,
          appearances: 0,
          totalRank: 0,
          queries: [],
          urls: new Set(),
        });
      }

      const domainStats = stats.get(domain)!;
      domainStats.appearances++;
      domainStats.totalRank += i + 1; // 1-indexed rank
      domainStats.queries.push(result.query);
      domainStats.urls.add(item.url);
    }
  }

  return stats;
}

/**
 * Build competitor list from domain stats
 */
function buildCompetitorList(
  stats: Map<string, DomainStats>,
  results: TavilySearchResult[],
  totalQueries: number,
  maxCompetitors: number
): CompetitorVisibility[] {
  const competitors: CompetitorVisibility[] = [];

  // Filter and sort domains
  const sortedDomains = [...stats.entries()]
    .filter(([, s]) => s.appearances >= MIN_APPEARANCES)
    .sort((a, b) => {
      // Sort by appearances first, then by average rank
      if (b[1].appearances !== a[1].appearances) {
        return b[1].appearances - a[1].appearances;
      }
      const avgRankA = a[1].totalRank / a[1].appearances;
      const avgRankB = b[1].totalRank / b[1].appearances;
      return avgRankA - avgRankB;
    })
    .slice(0, maxCompetitors);

  for (const [domain, domainStats] of sortedDomains) {
    const avgRank = domainStats.totalRank / domainStats.appearances;
    const citationRate = (domainStats.appearances / totalQueries) * 100;

    // Identify strengths based on query types they win
    const strengths = identifyStrengths(domainStats, results);

    competitors.push({
      domain,
      citationCount: domainStats.appearances,
      citationRate,
      averageRank: Math.round(avgRank * 10) / 10,
      topQueries: domainStats.queries.slice(0, 5),
      strengths,
    });
  }

  return competitors;
}

/**
 * Identify competitor strengths based on where they appear
 */
function identifyStrengths(
  stats: DomainStats,
  results: TavilySearchResult[]
): string[] {
  const strengths: string[] = [];

  // Check if they rank #1 frequently
  let topRankCount = 0;
  for (const result of results) {
    if (result.results[0]?.domain === stats.domain) {
      topRankCount++;
    }
  }
  if (topRankCount >= 2) {
    strengths.push(`Ranks #1 for ${topRankCount} queries`);
  }

  // Check if they appear in most results
  const appearanceRate = (stats.appearances / results.length) * 100;
  if (appearanceRate >= 50) {
    strengths.push(`Appears in ${Math.round(appearanceRate)}% of searches`);
  }

  // Check for diverse content (multiple URLs)
  if (stats.urls.size >= 3) {
    strengths.push(`Multiple pages ranking (${stats.urls.size} URLs)`);
  }

  // Add generic strength if none identified
  if (strengths.length === 0) {
    const avgRank = stats.totalRank / stats.appearances;
    if (avgRank <= 3) {
      strengths.push('Consistently high rankings');
    } else {
      strengths.push('Appears in relevant searches');
    }
  }

  return strengths;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

