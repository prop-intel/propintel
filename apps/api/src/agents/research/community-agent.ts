/**
 * Community Engagement Agent
 *
 * Finds engagement opportunities on community platforms (Reddit, Twitter/X, Hacker News)
 * by searching for discussions relevant to the brand's industry/topic.
 *
 * Instead of just searching for brand mentions, this agent finds posts where
 * the brand could add value by participating in the conversation.
 *
 * Example: If analyzing vercel.com, it finds posts like:
 * - "Where should I deploy my Next.js app?"
 * - "Best frontend hosting in 2024?"
 * - "Looking for Netlify alternatives"
 */

import { type TargetQuery } from '../../types';
import { search, searchBatch, isConfigured } from '../../lib/tavily';
import { createTrace, flushLangfuse } from '../../lib/langfuse';

// ===================
// Types
// ===================

export interface EngagementOpportunity {
  platform: 'reddit' | 'twitter' | 'hackernews' | 'other';
  url: string;
  title: string;
  snippet: string;
  query: string; // The query that found this
  relevanceScore: number; // 0-100
  opportunityType: 'question' | 'recommendation-request' | 'comparison' | 'discussion' | 'complaint';
  foundAt: string;
}

export interface CommunityEngagementResult {
  totalOpportunities: number;
  platforms: {
    reddit: EngagementOpportunity[];
    twitter: EngagementOpportunity[];
    hackernews: EngagementOpportunity[];
    other: EngagementOpportunity[];
  };
  topOpportunities: EngagementOpportunity[];
  queryBreakdown: {
    query: string;
    opportunitiesFound: number;
  }[];
  searchedAt: string;
}

// ===================
// Configuration
// ===================

const PLATFORMS = [
  { name: 'reddit', siteQuery: 'site:reddit.com' },
  { name: 'twitter', siteQuery: 'site:x.com OR site:twitter.com' },
  { name: 'hackernews', siteQuery: 'site:news.ycombinator.com' },
] as const;

// Question/discussion indicators to boost relevance
const OPPORTUNITY_INDICATORS = {
  question: ['?', 'how do', 'how to', 'what is', 'which', 'should i', 'can i', 'help with', 'looking for', 'need'],
  'recommendation-request': ['recommend', 'suggestion', 'best', 'top', 'alternative', 'instead of', 'switch from'],
  comparison: ['vs', 'versus', 'compared to', 'better than', 'or'],
  complaint: ['issue', 'problem', 'frustrated', 'disappointed', 'broken', 'not working', 'hate'],
  discussion: ['thoughts on', 'opinion', 'experience with', 'anyone using', 'who uses'],
};

const SEARCH_CONCURRENCY = 2;
const MAX_RESULTS_PER_QUERY = 5;

// ===================
// Main Function
// ===================

/**
 * Search community platforms for engagement opportunities
 *
 * Uses target queries (what the brand should rank for) to find discussions
 * where the brand could participate and add value.
 */
export async function searchCommunitySignals(
  queries: TargetQuery[],
  targetDomain: string,
  tenantId: string,
  jobId: string
): Promise<CommunityEngagementResult> {
  if (!isConfigured()) {
    console.warn('[Community Agent] Tavily not configured, returning empty results');
    return createEmptyResult();
  }

  const trace = createTrace({
    name: 'community-engagement-search',
    userId: tenantId,
    metadata: { jobId, queryCount: queries.length, targetDomain },
  });

  const span = trace.span({
    name: 'search-engagement-opportunities',
    input: { queryCount: queries.length, platforms: PLATFORMS.map(p => p.name) },
  });

  try {
    // Build platform-specific search queries from target queries
    const searchQueries = buildSearchQueries(queries);
    console.log(`[Community Agent] Built ${searchQueries.length} search queries from ${queries.length} target queries`);

    // Execute searches
    const searchResults = await searchBatch(
      searchQueries.map(q => q.searchQuery),
      {
        maxResults: MAX_RESULTS_PER_QUERY,
        searchDepth: 'basic',
        concurrency: SEARCH_CONCURRENCY,
      }
    );

    // Process results into engagement opportunities
    const allOpportunities: EngagementOpportunity[] = [];

    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      const queryInfo = searchQueries[i];

      if (!result || !queryInfo) continue;

      for (const item of result.results) {
        const opportunity = processResult(item, queryInfo);
        if (opportunity) {
          allOpportunities.push(opportunity);
        }
      }
    }

    // Deduplicate by URL
    const uniqueOpportunities = deduplicateByUrl(allOpportunities);

    // Sort by relevance
    uniqueOpportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Categorize by platform
    const platforms = categorizePlatforms(uniqueOpportunities);

    // Build query breakdown
    const queryBreakdown = buildQueryBreakdown(searchQueries, searchResults);

    const result: CommunityEngagementResult = {
      totalOpportunities: uniqueOpportunities.length,
      platforms,
      topOpportunities: uniqueOpportunities.slice(0, 15),
      queryBreakdown,
      searchedAt: new Date().toISOString(),
    };

    span.end({
      output: {
        totalOpportunities: result.totalOpportunities,
        reddit: platforms.reddit.length,
        twitter: platforms.twitter.length,
        hackernews: platforms.hackernews.length,
      },
    });

    await flushLangfuse();

    console.log(`[Community Agent] Found ${result.totalOpportunities} engagement opportunities`);
    return result;
  } catch (error) {
    span.end({
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await flushLangfuse();
    throw error;
  }
}

// ===================
// Query Building
// ===================

interface SearchQueryInfo {
  searchQuery: string;
  originalQuery: string;
  platform: string;
}

/**
 * Build platform-specific search queries from target queries
 *
 * For each target query, we create searches across Reddit, Twitter, and HN
 * looking for discussions where someone might need the brand's solution.
 */
function buildSearchQueries(targetQueries: TargetQuery[]): SearchQueryInfo[] {
  const searchQueries: SearchQueryInfo[] = [];

  // Take top queries by relevance (limit to avoid too many API calls)
  const topQueries = targetQueries
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);

  for (const tq of topQueries) {
    // For each target query, search across platforms
    for (const platform of PLATFORMS) {
      // Create the search query with site: operator
      const searchQuery = `${platform.siteQuery} ${tq.query}`;

      searchQueries.push({
        searchQuery,
        originalQuery: tq.query,
        platform: platform.name,
      });
    }
  }

  return searchQueries;
}

// ===================
// Result Processing
// ===================

interface TavilyResultItem {
  title: string;
  url: string;
  content: string;
  score: number;
  domain: string;
}

/**
 * Process a single search result into an engagement opportunity
 */
function processResult(
  item: TavilyResultItem,
  queryInfo: SearchQueryInfo
): EngagementOpportunity | null {
  const platform = detectPlatform(item.url);

  // Skip if not a community platform
  if (platform === 'other') {
    return null;
  }

  const opportunityType = detectOpportunityType(item.title, item.content);
  const relevanceScore = calculateRelevance(item, queryInfo.originalQuery, opportunityType);

  return {
    platform,
    url: item.url,
    title: item.title,
    snippet: item.content.slice(0, 300),
    query: queryInfo.originalQuery,
    relevanceScore,
    opportunityType,
    foundAt: new Date().toISOString(),
  };
}

/**
 * Detect which platform a URL belongs to
 */
function detectPlatform(url: string): EngagementOpportunity['platform'] {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('reddit.com')) return 'reddit';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  if (urlLower.includes('news.ycombinator.com') || urlLower.includes('hn.algolia.com')) return 'hackernews';

  return 'other';
}

/**
 * Detect the type of engagement opportunity
 */
function detectOpportunityType(title: string, content: string): EngagementOpportunity['opportunityType'] {
  const text = `${title} ${content}`.toLowerCase();

  // Check each type in priority order
  for (const [type, indicators] of Object.entries(OPPORTUNITY_INDICATORS)) {
    for (const indicator of indicators) {
      if (text.includes(indicator)) {
        return type as EngagementOpportunity['opportunityType'];
      }
    }
  }

  return 'discussion';
}

/**
 * Calculate relevance score for an opportunity
 */
function calculateRelevance(
  item: TavilyResultItem,
  originalQuery: string,
  opportunityType: EngagementOpportunity['opportunityType']
): number {
  let score = item.score * 100;

  // Boost for question-type posts (higher engagement potential)
  if (opportunityType === 'question') {
    score += 15;
  } else if (opportunityType === 'recommendation-request') {
    score += 20; // Highest value - someone actively seeking recommendations
  } else if (opportunityType === 'comparison') {
    score += 10;
  }

  // Boost if title contains query terms
  const queryTerms = originalQuery.toLowerCase().split(' ').filter(t => t.length > 3);
  const titleLower = item.title.toLowerCase();
  const matchingTerms = queryTerms.filter(t => titleLower.includes(t));
  score += (matchingTerms.length / queryTerms.length) * 10;

  // Penalize very short content (might be low quality)
  if (item.content.length < 50) {
    score -= 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ===================
// Utility Functions
// ===================

/**
 * Deduplicate opportunities by URL
 */
function deduplicateByUrl(opportunities: EngagementOpportunity[]): EngagementOpportunity[] {
  const seen = new Set<string>();
  const unique: EngagementOpportunity[] = [];

  for (const opp of opportunities) {
    // Normalize URL for comparison
    const normalizedUrl = opp.url.split('?')[0]?.toLowerCase() || opp.url.toLowerCase();
    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      unique.push(opp);
    }
  }

  return unique;
}

/**
 * Categorize opportunities by platform
 */
function categorizePlatforms(opportunities: EngagementOpportunity[]): CommunityEngagementResult['platforms'] {
  const platforms: CommunityEngagementResult['platforms'] = {
    reddit: [],
    twitter: [],
    hackernews: [],
    other: [],
  };

  for (const opp of opportunities) {
    platforms[opp.platform].push(opp);
  }

  return platforms;
}

/**
 * Build breakdown of opportunities per original query
 */
function buildQueryBreakdown(
  searchQueries: SearchQueryInfo[],
  searchResults: Array<{ query: string; results: TavilyResultItem[] }>
): CommunityEngagementResult['queryBreakdown'] {
  const queryMap = new Map<string, number>();

  for (let i = 0; i < searchQueries.length; i++) {
    const queryInfo = searchQueries[i];
    const result = searchResults[i];

    if (!queryInfo || !result) continue;

    const current = queryMap.get(queryInfo.originalQuery) || 0;
    // Count only community platform results
    const communityResults = result.results.filter(r => detectPlatform(r.url) !== 'other');
    queryMap.set(queryInfo.originalQuery, current + communityResults.length);
  }

  return Array.from(queryMap.entries())
    .map(([query, count]) => ({
      query,
      opportunitiesFound: count,
    }))
    .sort((a, b) => b.opportunitiesFound - a.opportunitiesFound);
}

/**
 * Create empty result when Tavily is not configured
 */
function createEmptyResult(): CommunityEngagementResult {
  return {
    totalOpportunities: 0,
    platforms: {
      reddit: [],
      twitter: [],
      hackernews: [],
      other: [],
    },
    topOpportunities: [],
    queryBreakdown: [],
    searchedAt: new Date().toISOString(),
  };
}
