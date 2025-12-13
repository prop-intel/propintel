/**
 * Competitor Discovery Agent
 *
 * Discovers REAL BUSINESS competitors - other companies where
 * a customer could choose to go INSTEAD.
 * 
 * This is different from "visibility competitors" (anyone who ranks).
 * We filter out content platforms (YouTube, Medium, Wikipedia) and
 * use business context to identify actual competitors.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Langfuse } from 'langfuse';
import { type TargetQuery, type CompetitorVisibility, type TavilySearchResult, type BusinessCategory } from '../../types';
import { searchBatch } from '../../lib/tavily';

// ===================
// Timeout Configuration
// ===================

// 60 second timeout for LLM API calls to prevent indefinite hangs
const LLM_TIMEOUT_MS = 60_000;

// ===================
// Configuration
// ===================

const MAX_COMPETITORS = 10;
const MIN_APPEARANCES = 1; // Lowered since we filter more aggressively

// Content platforms to always exclude - these are never real business competitors
const CONTENT_PLATFORMS = new Set([
  'youtube.com',
  'medium.com',
  'wikipedia.org',
  'reddit.com',
  'quora.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'github.com',
  'stackoverflow.com',
  'dev.to',
  'hashnode.dev',
  'substack.com',
  'wordpress.com',
  'blogger.com',
  'tumblr.com',
  'news.ycombinator.com',
]);

// Generic info sites to exclude
const INFO_SITES = new Set([
  'forbes.com',
  'businessinsider.com',
  'techcrunch.com',
  'wired.com',
  'theverge.com',
  'cnet.com',
  'zdnet.com',
  'entrepreneur.com',
  'inc.com',
  'investopedia.com',
  'hubspot.com', // Content marketing, not competitor for most
  'nerdwallet.com',
  'g2.com',
  'capterra.com',
  'trustpilot.com',
]);

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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
// Business Context
// ===================

export interface BusinessContext {
  companyName: string;
  businessCategory: BusinessCategory;
  businessModel: string;
  competitorProfile: string;
}

// ===================
// LLM Schema for Competitor Validation
// ===================

const CompetitorValidationSchema = z.object({
  validCompetitors: z.array(z.object({
    domain: z.string(),
    isRealCompetitor: z.boolean().describe('Is this a real business competitor where a customer could choose to go instead?'),
    reason: z.string().describe('Brief explanation of why this is or is not a real competitor'),
    competitorType: z.string().optional().describe('Type of competitor: direct, indirect, or content-only'),
  })),
});

// ===================
// Main Function
// ===================

/**
 * Discover REAL BUSINESS competitors based on target queries and business context
 */
export async function discoverCompetitors(
  queries: TargetQuery[],
  targetDomain: string,
  tenantId: string,
  jobId: string,
  options: {
    maxCompetitors?: number;
    searchResults?: TavilySearchResult[]; // Reuse if already searched
    businessContext?: BusinessContext; // Business understanding for filtering
  } = {}
): Promise<CompetitorVisibility[]> {
  const { maxCompetitors = MAX_COMPETITORS, searchResults, businessContext } = options;

  const trace = langfuse.trace({
    name: 'aeo-competitor-discovery',
    userId: tenantId,
    metadata: { jobId, targetDomain, queryCount: queries.length, hasBusinessContext: !!businessContext },
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

    // STEP 1: Filter out obvious content platforms
    const filteredStats = filterContentPlatforms(domainStats);

    // STEP 2: Build initial competitor list
    let competitors = buildCompetitorList(
      filteredStats,
      results,
      queries.length,
      maxCompetitors * 2 // Get more candidates for LLM filtering
    );

    // STEP 3: If we have business context, use LLM to validate real competitors
    if (businessContext && competitors.length > 0) {
      competitors = await validateCompetitorsWithLLM(
        competitors,
        businessContext,
        tenantId,
        trace
      );
    }

    // Limit to requested max
    competitors = competitors.slice(0, maxCompetitors);

    span.end({
      output: {
        competitorsFound: competitors.length,
        topCompetitor: competitors[0]?.domain,
        filteredOut: domainStats.size - filteredStats.size,
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
 * Filter out known content platforms that are never real business competitors
 */
function filterContentPlatforms(stats: Map<string, DomainStats>): Map<string, DomainStats> {
  const filtered = new Map<string, DomainStats>();
  
  for (const [domain, domainStats] of stats) {
    // Check if domain matches any content platform
    const isContentPlatform = [...CONTENT_PLATFORMS].some(platform => 
      domain === platform || domain.endsWith('.' + platform)
    );
    
    const isInfoSite = [...INFO_SITES].some(site => 
      domain === site || domain.endsWith('.' + site)
    );
    
    if (!isContentPlatform && !isInfoSite) {
      filtered.set(domain, domainStats);
    }
  }
  
  return filtered;
}

/**
 * Use LLM to validate which domains are real business competitors
 */
async function validateCompetitorsWithLLM(
  candidates: CompetitorVisibility[],
  businessContext: BusinessContext,
  tenantId: string,
  trace: ReturnType<Langfuse['trace']>
): Promise<CompetitorVisibility[]> {
  const generation = trace.generation({
    name: 'competitor-validation',
    model: 'gpt-4o-mini',
  });

  try {
    const systemPrompt = `You are an expert business analyst specializing in competitive intelligence.

Your task is to identify which domains are REAL BUSINESS COMPETITORS vs content/information sites.

A REAL COMPETITOR is:
- Another company where a customer could CHOOSE to go INSTEAD
- Offers similar products/services to the same target audience
- Competes for the same customer dollars/attention

NOT a real competitor:
- Content platforms (even if they have related content)
- News/media sites writing about the industry
- Review/comparison aggregator sites
- Educational content sites (unless the business IS education)
- Generic directories or marketplaces (unless the business IS a marketplace)

Be strict. Only mark as "isRealCompetitor: true" if a customer evaluating ${businessContext.companyName} would also realistically evaluate this company.`;

    const userPrompt = `Business being analyzed:
- Company: ${businessContext.companyName}
- Category: ${businessContext.businessCategory}
- Business Model: ${businessContext.businessModel}
- What a competitor looks like: ${businessContext.competitorProfile}

Candidate domains found in search results:
${candidates.map(c => `- ${c.domain} (appeared in ${c.citationCount} queries)`).join('\n')}

For each domain, determine if it's a REAL business competitor or just a content/visibility competitor.`;

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: CompetitorValidationSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    generation.end({
      output: result.object,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    // Filter to only real competitors
    const validDomains = new Set(
      result.object.validCompetitors
        .filter(v => v.isRealCompetitor)
        .map(v => v.domain)
    );

    // Update competitor info with validation results
    return candidates
      .filter(c => validDomains.has(c.domain))
      .map(c => {
        const validation = result.object.validCompetitors.find(v => v.domain === c.domain);
        return {
          ...c,
          strengths: [
            ...c.strengths,
            validation?.competitorType === 'direct' ? 'Direct competitor' : 'Indirect competitor',
          ],
        };
      });
  } catch (error) {
    generation.end({
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    // On error, return candidates without LLM filtering
    console.warn('[CompetitorDiscovery] LLM validation failed, returning unfiltered results:', error);
    return candidates;
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

