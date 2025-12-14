/**
 * Tavily API Client
 *
 * Tavily is a search API optimized for AI applications.
 * It provides comprehensive search results with relevance scoring.
 *
 * @see https://docs.tavily.com/
 */

import { type TavilySearchResult, type TavilyResult } from '../types';

// ===================
// Configuration
// ===================

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const TAVILY_API_URL = 'https://api.tavily.com/search';

// Default number of results per query
const DEFAULT_MAX_RESULTS = 10;

// ===================
// Types
// ===================

interface TavilyApiRequest {
  api_key: string;
  query: string;
  search_depth?: 'basic' | 'advanced';
  include_answer?: boolean;
  include_raw_content?: boolean;
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
}

interface TavilyApiResponse {
  query: string;
  answer?: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content?: string;
  }>;
  response_time?: number;
}

// ===================
// Client Functions
// ===================

/**
 * Search Tavily for a single query
 */
export async function search(
  query: string,
  options: {
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<TavilySearchResult> {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY environment variable is not set');
  }

  const {
    maxResults = DEFAULT_MAX_RESULTS,
    searchDepth = 'basic',
    includeDomains,
    excludeDomains,
  } = options;

  const requestBody: TavilyApiRequest = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: searchDepth,
    include_answer: false,
    include_raw_content: false,
    max_results: maxResults,
  };

  if (includeDomains?.length) {
    requestBody.include_domains = includeDomains;
  }

  if (excludeDomains?.length) {
    requestBody.exclude_domains = excludeDomains;
  }

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as TavilyApiResponse;

  // Transform to our format
  const results: TavilyResult[] = data.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
    domain: extractDomain(r.url),
  }));

  return {
    query: data.query,
    results,
    searchedAt: new Date().toISOString(),
  };
}

/**
 * Progress callback for batch operations
 */
export type BatchProgressCallback = (progress: {
  completed: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  lastQuery?: string;
}) => void;

/**
 * Search Tavily for multiple queries in parallel
 */
export async function searchBatch(
  queries: string[],
  options: {
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
    concurrency?: number;
    onProgress?: BatchProgressCallback;
  } = {}
): Promise<TavilySearchResult[]> {
  const { concurrency = 3, onProgress, ...searchOptions } = options;

  console.log(`[Tavily] Starting batch search: ${queries.length} queries, concurrency: ${concurrency}`);

  // Process in batches to avoid rate limiting
  const results: TavilySearchResult[] = [];
  const totalBatches = Math.ceil(queries.length / concurrency);

  for (let i = 0; i < queries.length; i += concurrency) {
    const batchNum = Math.floor(i / concurrency) + 1;
    const batch = queries.slice(i, i + concurrency);
    
    console.log(`[Tavily] Batch ${batchNum}/${totalBatches}: searching ${batch.length} queries...`);
    const batchStartTime = Date.now();
    
    const batchResults = await Promise.all(
      batch.map((query) =>
        search(query, searchOptions).catch((error) => {
          console.error(`[Tavily] Search failed for query "${query}":`, error);
          // Return empty result on error
          return {
            query,
            results: [],
            searchedAt: new Date().toISOString(),
          } as TavilySearchResult;
        })
      )
    );
    results.push(...batchResults);
    
    console.log(`[Tavily] Batch ${batchNum}/${totalBatches} completed in ${Date.now() - batchStartTime}ms`);

    // Report progress after each batch
    if (onProgress) {
      onProgress({
        completed: Math.min(i + concurrency, queries.length),
        total: queries.length,
        currentBatch: batchNum,
        totalBatches,
        lastQuery: batch[batch.length - 1],
      });
    }

    // Small delay between batches to be respectful of rate limits
    if (i + concurrency < queries.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`[Tavily] Batch search complete: ${results.length} results`);
  return results;
}

/**
 * Search for competitor domains ranking for specific queries
 */
export async function findCompetitors(
  queries: string[],
  targetDomain: string,
  options: {
    maxResults?: number;
  } = {}
): Promise<Map<string, number>> {
  const searchResults = await searchBatch(queries, {
    maxResults: options.maxResults || 10,
    searchDepth: 'basic',
    excludeDomains: [targetDomain], // Exclude the target domain to find competitors
  });

  // Count domain occurrences across all queries
  const domainCounts = new Map<string, number>();

  for (const result of searchResults) {
    for (const item of result.results) {
      const count = domainCounts.get(item.domain) || 0;
      domainCounts.set(item.domain, count + 1);
    }
  }

  // Sort by count descending
  return new Map(
    [...domainCounts.entries()].sort((a, b) => b[1] - a[1])
  );
}

/**
 * Check if a specific domain appears in search results for queries
 */
export async function checkDomainVisibility(
  queries: string[],
  targetDomain: string,
  options: {
    maxResults?: number;
  } = {}
): Promise<{
  totalQueries: number;
  foundInQueries: number;
  visibilityRate: number;
  queryResults: Array<{
    query: string;
    found: boolean;
    rank?: number;
  }>;
}> {
  const searchResults = await searchBatch(queries, {
    maxResults: options.maxResults || 10,
    searchDepth: 'basic',
  });

  const queryResults: Array<{
    query: string;
    found: boolean;
    rank?: number;
  }> = [];

  let foundInQueries = 0;

  for (const result of searchResults) {
    const targetResult = result.results.findIndex((r) =>
      r.domain.includes(targetDomain) || targetDomain.includes(r.domain)
    );

    const found = targetResult !== -1;
    if (found) {
      foundInQueries++;
    }

    queryResults.push({
      query: result.query,
      found,
      rank: found ? targetResult + 1 : undefined,
    });
  }

  return {
    totalQueries: queries.length,
    foundInQueries,
    visibilityRate: queries.length > 0 ? (foundInQueries / queries.length) * 100 : 0,
    queryResults,
  };
}

// ===================
// Utility Functions
// ===================

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Check if Tavily API key is configured
 */
export function isConfigured(): boolean {
  return !!TAVILY_API_KEY;
}

