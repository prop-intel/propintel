/**
 * Tavily Research Agent
 *
 * Searches for each target query using Tavily API and
 * extracts citation data - who appears, where, and how prominently.
 * Also includes community signal tracking (Reddit, HN, GitHub, Twitter).
 */

import { type TargetQuery, type TavilySearchResult, type QueryCitation } from '../../types';
import { search, searchBatch, isConfigured } from '../../lib/tavily';
import { createTrace, safeFlush } from '../../lib/langfuse';

// ===================
// Configuration
// ===================

const DEFAULT_RESULTS_PER_QUERY = 10;
const SEARCH_CONCURRENCY = 3;

// ===================
// Main Functions
// ===================

/**
 * Research all target queries and collect search results
 */
export async function researchQueries(
  queries: TargetQuery[],
  tenantId: string,
  jobId: string,
  options: {
    resultsPerQuery?: number;
  } = {}
): Promise<TavilySearchResult[]> {
  const { resultsPerQuery = DEFAULT_RESULTS_PER_QUERY } = options;

  // Check if Tavily is configured
  if (!isConfigured()) {
    console.warn('Tavily API key not configured, skipping research phase');
    return queries.map(q => ({
      query: q.query,
      results: [],
      searchedAt: new Date().toISOString(),
    }));
  }

  const trace = createTrace({
    name: 'aeo-tavily-research',
    userId: tenantId,
    metadata: { jobId, queryCount: queries.length },
  });

  const span = trace.span({
    name: 'research-queries',
  });

  try {
    // Extract query strings
    const queryStrings = queries.map(q => q.query);

    // Search all queries
    const results = await searchBatch(queryStrings, {
      maxResults: resultsPerQuery,
      searchDepth: 'basic',
      concurrency: SEARCH_CONCURRENCY,
    });

    span.end({
      output: {
        totalResults: results.reduce((sum, r) => sum + r.results.length, 0),
        queriesSearched: results.length,
      },
    });

    // Non-blocking flush - observability should never block business logic
    safeFlush();

    return results;
  } catch (error) {
    span.end({
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    // Non-blocking flush - still try to log errors
    safeFlush();
    throw error;
  }
}

/**
 * Analyze search results to find citations for a target domain
 */
export function analyzeCitations(
  searchResults: TavilySearchResult[],
  targetDomain: string
): QueryCitation[] {
  const citations: QueryCitation[] = [];

  for (const result of searchResults) {
    const citation = analyzeQueryCitation(result, targetDomain);
    citations.push(citation);
  }

  return citations;
}

/**
 * Analyze a single query's search results for target domain presence
 */
function analyzeQueryCitation(
  searchResult: TavilySearchResult,
  targetDomain: string
): QueryCitation {
  // Find target domain in results
  let yourPosition: 'cited' | 'mentioned' | 'absent' = 'absent';
  let yourRank: number | undefined;

  for (let i = 0; i < searchResult.results.length; i++) {
    const item = searchResult.results[i];
    if (item && domainMatches(item.domain, targetDomain)) {
      yourPosition = i < 3 ? 'cited' : 'mentioned';
      yourRank = i + 1;
      break;
    }
  }

  // Get top results
  const topResults = searchResult.results.slice(0, 5).map((r, i) => ({
    domain: r.domain,
    url: r.url,
    rank: i + 1,
  }));

  // Determine winning domain and reason
  let winningDomain: string | undefined;
  let winningReason: string | undefined;

  const firstTopResult = topResults[0];
  const firstResult = searchResult.results[0];
  if (yourPosition === 'absent' && firstTopResult && firstResult) {
    winningDomain = firstTopResult.domain;
    winningReason = determineWinningReason(firstResult, searchResult.query);
  }

  return {
    query: searchResult.query,
    yourPosition,
    yourRank,
    topResults,
    winningDomain,
    winningReason,
  };
}

/**
 * Calculate overall visibility metrics from citations
 */
export function calculateVisibilityMetrics(
  citations: QueryCitation[]
): {
  totalQueries: number;
  citedCount: number;
  mentionedCount: number;
  absentCount: number;
  citationRate: number;
  averageRank: number;
} {
  const totalQueries = citations.length;
  let citedCount = 0;
  let mentionedCount = 0;
  let absentCount = 0;
  let totalRank = 0;
  let rankedCount = 0;

  for (const citation of citations) {
    switch (citation.yourPosition) {
      case 'cited':
        citedCount++;
        break;
      case 'mentioned':
        mentionedCount++;
        break;
      case 'absent':
        absentCount++;
        break;
    }

    if (citation.yourRank) {
      totalRank += citation.yourRank;
      rankedCount++;
    }
  }

  return {
    totalQueries,
    citedCount,
    mentionedCount,
    absentCount,
    citationRate: totalQueries > 0 ? ((citedCount + mentionedCount) / totalQueries) * 100 : 0,
    averageRank: rankedCount > 0 ? totalRank / rankedCount : 0,
  };
}

/**
 * Get domains that appear most frequently in search results
 */
export function getFrequentDomains(
  searchResults: TavilySearchResult[],
  targetDomain: string,
  limit = 10
): Map<string, number> {
  const domainCounts = new Map<string, number>();

  for (const result of searchResults) {
    for (const item of result.results) {
      if (!domainMatches(item.domain, targetDomain)) {
        const count = domainCounts.get(item.domain) || 0;
        domainCounts.set(item.domain, count + 1);
      }
    }
  }

  // Sort and limit
  const sorted = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return new Map(sorted);
}

// ===================
// Helper Functions
// ===================

/**
 * Check if two domains match (handles www prefix and subdomains)
 */
function domainMatches(domain1: string, domain2: string): boolean {
  const normalize = (d: string) => d.replace(/^www\./, '').toLowerCase();
  const d1 = normalize(domain1);
  const d2 = normalize(domain2);

  return d1 === d2 || d1.endsWith(`.${d2}`) || d2.endsWith(`.${d1}`);
}

/**
 * Determine why a competitor might be winning for a query
 */
function determineWinningReason(
  topResult: TavilySearchResult['results'][0],
  query: string
): string {
  const reasons: string[] = [];

  // Check title relevance
  const queryTerms = query.toLowerCase().split(' ').filter(t => t.length > 3);
  const titleLower = topResult.title.toLowerCase();
  const matchingTerms = queryTerms.filter(t => titleLower.includes(t));

  if (matchingTerms.length >= queryTerms.length * 0.5) {
    reasons.push('Title closely matches query');
  }

  // Check content length (if substantial snippet)
  if (topResult.content.length > 300) {
    reasons.push('Comprehensive content');
  }

  // Check for authoritative domains
  const authoritativeDomains = [
    'wikipedia.org', 'github.com', 'stackoverflow.com',
    'microsoft.com', 'google.com', 'amazon.com', 'aws.amazon.com',
  ];
  if (authoritativeDomains.some(d => topResult.domain.includes(d))) {
    reasons.push('High domain authority');
  }

  // Default reason
  if (reasons.length === 0) {
    reasons.push('Better content relevance');
  }

  return reasons.join('; ');
}

// ===================
// Community Signals
// ===================

export interface CommunitySignal {
  platform: 'reddit' | 'hackernews' | 'github' | 'twitter' | 'other';
  url: string;
  title: string;
  snippet: string;
  engagement?: {
    score?: number;
    comments?: number;
    stars?: number;
  };
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  relevance: number; // 0-100
  foundAt: string;
}

export interface CommunitySignalsResult {
  totalMentions: number;
  platforms: {
    reddit: CommunitySignal[];
    hackernews: CommunitySignal[];
    github: CommunitySignal[];
    twitter: CommunitySignal[];
    other: CommunitySignal[];
  };
  engagementScore: number; // 0-100
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topMentions: CommunitySignal[];
  trainingDataIndicators: string[];
}

/**
 * Search for community signals about a domain/brand
 */
export async function searchCommunitySignals(
  domain: string,
  brandName: string,
  tenantId: string,
  jobId: string
): Promise<CommunitySignalsResult> {
  if (!isConfigured()) {
    return createEmptyCommunityResult();
  }

  const trace = createTrace({
    name: 'aeo-community-signals',
    userId: tenantId,
    metadata: { jobId, domain, brandName },
  });

  const span = trace.span({
    name: 'search-community-signals',
  });

  try {
    // Build search queries for universal platforms (works for any industry)
    const queries = [
      `site:reddit.com "${brandName}"`,
      `site:twitter.com OR site:x.com "${brandName}"`,
      `${brandName} review`,
      `${brandName} alternative`,
      `"${domain}" discussion`,
    ];

    // Search all queries
    const searchResults = await searchBatch(queries, {
      maxResults: 10,
      searchDepth: 'basic',
    });

    // Process and categorize results
    const allSignals: CommunitySignal[] = [];

    for (const result of searchResults) {
      for (const item of result.results) {
        const signal = processSearchResult(item, result.query);
        allSignals.push(signal);
      }
    }

    // Categorize by platform
    const platforms = categorizeByPlatform(allSignals);

    // Calculate engagement score
    const engagementScore = calculateEngagementScore(allSignals);

    // Analyze sentiment
    const sentimentBreakdown = analyzeSentiment(allSignals);

    // Get top mentions
    const topMentions = allSignals
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);

    // Identify training data indicators
    const trainingDataIndicators = identifyTrainingDataIndicators(allSignals);

    span.end({
      output: {
        totalMentions: allSignals.length,
        engagementScore,
        platforms: {
          reddit: platforms.reddit.length,
          hackernews: platforms.hackernews.length,
          github: platforms.github.length,
        },
      },
    });

    // Non-blocking flush - observability should never block business logic
    safeFlush();

    return {
      totalMentions: allSignals.length,
      platforms,
      engagementScore,
      sentimentBreakdown,
      topMentions,
      trainingDataIndicators,
    };
  } catch (error) {
    span.end({
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    // Non-blocking flush - still try to log errors
    safeFlush();
    throw error;
  }
}

/**
 * Process a search result into a community signal
 */
function processSearchResult(
  result: TavilySearchResult['results'][0],
  query: string
): CommunitySignal {
  const platform = detectPlatform(result.url);
  const sentiment = detectSentiment(result.content, result.title);
  const relevance = calculateRelevance(result, query);

  return {
    platform,
    url: result.url,
    title: result.title,
    snippet: result.content.slice(0, 300),
    sentiment,
    relevance,
    foundAt: new Date().toISOString(),
  };
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): CommunitySignal['platform'] {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('reddit.com')) return 'reddit';
  if (urlLower.includes('news.ycombinator.com') || urlLower.includes('hn.algolia.com')) return 'hackernews';
  if (urlLower.includes('github.com')) return 'github';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';

  return 'other';
}

/**
 * Simple sentiment detection from text
 */
function detectSentiment(content: string, title: string): CommunitySignal['sentiment'] {
  const text = `${title} ${content}`.toLowerCase();

  const positiveWords = ['great', 'awesome', 'excellent', 'love', 'best', 'amazing', 'recommend', 'helpful', 'useful'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'avoid', 'problem', 'issue', 'broken', 'bug'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (text.includes(word)) positiveCount++;
  }

  for (const word of negativeWords) {
    if (text.includes(word)) negativeCount++;
  }

  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  if (positiveCount > 0 || negativeCount > 0) return 'neutral';

  return 'unknown';
}

/**
 * Calculate relevance score
 */
function calculateRelevance(
  result: TavilySearchResult['results'][0],
  query: string
): number {
  let score = result.score * 100;

  // Boost for community platforms
  const platform = detectPlatform(result.url);
  if (platform !== 'other') {
    score += 10;
  }

  // Cap at 100
  return Math.min(100, Math.round(score));
}

/**
 * Categorize signals by platform
 */
function categorizeByPlatform(signals: CommunitySignal[]): CommunitySignalsResult['platforms'] {
  const platforms: CommunitySignalsResult['platforms'] = {
    reddit: [],
    hackernews: [],
    github: [],
    twitter: [],
    other: [],
  };

  for (const signal of signals) {
    platforms[signal.platform].push(signal);
  }

  return platforms;
}

/**
 * Calculate overall engagement score
 */
function calculateEngagementScore(signals: CommunitySignal[]): number {
  if (signals.length === 0) return 0;

  // Base score from number of mentions
  let score = Math.min(50, signals.length * 5);

  // Bonus for platform diversity
  const platforms = new Set(signals.map(s => s.platform));
  score += platforms.size * 10;

  // Bonus for positive sentiment
  const positiveCount = signals.filter(s => s.sentiment === 'positive').length;
  score += (positiveCount / signals.length) * 20;

  return Math.min(100, Math.round(score));
}

/**
 * Analyze sentiment distribution
 */
function analyzeSentiment(signals: CommunitySignal[]): CommunitySignalsResult['sentimentBreakdown'] {
  const total = signals.length || 1;

  return {
    positive: signals.filter(s => s.sentiment === 'positive').length / total,
    neutral: signals.filter(s => s.sentiment === 'neutral' || s.sentiment === 'unknown').length / total,
    negative: signals.filter(s => s.sentiment === 'negative').length / total,
  };
}

/**
 * Identify indicators that content might be in LLM training data
 */
function identifyTrainingDataIndicators(signals: CommunitySignal[]): string[] {
  const indicators: string[] = [];

  // High-engagement Reddit posts often make it into training data
  const redditSignals = signals.filter(s => s.platform === 'reddit');
  if (redditSignals.length >= 5) {
    indicators.push('Multiple Reddit discussions may influence LLM knowledge');
  }

  // HN discussions are often in training data
  const hnSignals = signals.filter(s => s.platform === 'hackernews');
  if (hnSignals.length >= 2) {
    indicators.push('Hacker News mentions likely in LLM training corpus');
  }

  // GitHub presence indicates technical credibility
  const githubSignals = signals.filter(s => s.platform === 'github');
  if (githubSignals.length >= 3) {
    indicators.push('Strong GitHub presence - likely recognized by AI');
  }

  // High total mentions
  if (signals.length >= 15) {
    indicators.push('High community presence increases LLM recognition probability');
  }

  return indicators;
}

/**
 * Create empty community result when Tavily not configured
 */
function createEmptyCommunityResult(): CommunitySignalsResult {
  return {
    totalMentions: 0,
    platforms: {
      reddit: [],
      hackernews: [],
      github: [],
      twitter: [],
      other: [],
    },
    engagementScore: 0,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    topMentions: [],
    trainingDataIndicators: ['Tavily API not configured - community signals unavailable'],
  };
}

