/**
 * Citation Analysis Agent
 *
 * Analyzes citation patterns to determine:
 * - How often the target domain is cited
 * - Position in search results
 * - Patterns in winning vs losing queries
 */

import {
  type QueryCitation,
  type QueryGap,
  type TavilySearchResult,
} from "../../types";

// ===================
// Types
// ===================

export interface CitationAnalysisResult {
  // Overall metrics
  totalQueries: number;
  citedQueries: number;
  mentionedQueries: number;
  absentQueries: number;
  citationRate: number; // percentage

  // Position analysis
  averageRank: number;
  top3Count: number;
  top3Rate: number;

  // Pattern analysis
  queryTypesWinning: Map<string, number>;
  queryTypesLosing: Map<string, number>;

  // Gap identification
  gaps: QueryGap[];

  // Key findings
  findings: string[];
}

// ===================
// Main Function
// ===================

/**
 * Perform comprehensive citation analysis
 */
export async function analyzeCitationPatterns(
  citations: QueryCitation[],
  searchResults: TavilySearchResult[],
  targetDomain: string,
  _tenantId: string,
  _jobId: string,
): Promise<CitationAnalysisResult> {
  try {
    // Calculate basic metrics
    const metrics = calculateBasicMetrics(citations);

    // Analyze query type patterns
    const patterns = analyzeQueryPatterns(citations, searchResults);

    // Identify gaps (queries where we should be winning)
    const gaps = identifyGaps(citations, searchResults, targetDomain);

    // Generate key findings
    const findings = generateFindings(metrics, patterns, gaps);

    const result: CitationAnalysisResult = {
      ...metrics,
      queryTypesWinning: patterns.winning,
      queryTypesLosing: patterns.losing,
      gaps,
      findings,
    };

    return result;
  } catch (error) {
    throw error;
  }
}

// ===================
// Analysis Functions
// ===================

/**
 * Calculate basic citation metrics
 */
function calculateBasicMetrics(citations: QueryCitation[]): {
  totalQueries: number;
  citedQueries: number;
  mentionedQueries: number;
  absentQueries: number;
  citationRate: number;
  averageRank: number;
  top3Count: number;
  top3Rate: number;
} {
  const totalQueries = citations.length;
  let citedQueries = 0;
  let mentionedQueries = 0;
  let absentQueries = 0;
  let totalRank = 0;
  let rankedCount = 0;
  let top3Count = 0;

  for (const citation of citations) {
    switch (citation.yourPosition) {
      case "cited":
        citedQueries++;
        if (citation.yourRank && citation.yourRank <= 3) {
          top3Count++;
        }
        break;
      case "mentioned":
        mentionedQueries++;
        break;
      case "absent":
        absentQueries++;
        break;
    }

    if (citation.yourRank) {
      totalRank += citation.yourRank;
      rankedCount++;
    }
  }

  const appearsIn = citedQueries + mentionedQueries;

  return {
    totalQueries,
    citedQueries,
    mentionedQueries,
    absentQueries,
    citationRate: totalQueries > 0 ? (appearsIn / totalQueries) * 100 : 0,
    averageRank: rankedCount > 0 ? totalRank / rankedCount : 0,
    top3Count,
    top3Rate: totalQueries > 0 ? (top3Count / totalQueries) * 100 : 0,
  };
}

/**
 * Analyze patterns in winning vs losing queries
 */
function analyzeQueryPatterns(
  citations: QueryCitation[],
  _searchResults: TavilySearchResult[],
): {
  winning: Map<string, number>;
  losing: Map<string, number>;
} {
  const winning = new Map<string, number>();
  const losing = new Map<string, number>();

  for (const citation of citations) {
    const queryType = classifyQueryType(citation.query);

    if (citation.yourPosition !== "absent") {
      winning.set(queryType, (winning.get(queryType) || 0) + 1);
    } else {
      losing.set(queryType, (losing.get(queryType) || 0) + 1);
    }
  }

  return { winning, losing };
}

/**
 * Classify query into type
 */
function classifyQueryType(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.startsWith("how to") || lowerQuery.includes("how do")) {
    return "how-to";
  }
  if (lowerQuery.startsWith("what is") || lowerQuery.startsWith("what are")) {
    return "what-is";
  }
  if (
    lowerQuery.includes(" vs ") ||
    lowerQuery.includes("versus") ||
    lowerQuery.includes("compared to")
  ) {
    return "comparison";
  }
  if (lowerQuery.startsWith("best ") || lowerQuery.includes("best way")) {
    return "best";
  }
  if (lowerQuery.startsWith("why ")) {
    return "why";
  }

  return "other";
}

/**
 * Identify gaps - queries where we should be winning but aren't
 */
function identifyGaps(
  citations: QueryCitation[],
  searchResults: TavilySearchResult[],
  _targetDomain: string,
): QueryGap[] {
  const gaps: QueryGap[] = [];

  for (const citation of citations) {
    // Only analyze queries where we're absent or poorly ranked
    if (
      citation.yourPosition === "absent" ||
      (citation.yourRank && citation.yourRank > 5)
    ) {
      const searchResult = searchResults.find(
        (r) => r.query === citation.query,
      );
      if (!searchResult || searchResult.results.length === 0) continue;

      const winner = searchResult.results[0];
      if (!winner) continue;

      gaps.push({
        query: citation.query,
        yourPosition: citation.yourPosition,
        winningDomain: winner.domain,
        winningUrl: winner.url,
        winningReason: analyzeWinnerContent(winner, citation.query),
        suggestedAction: generateSuggestedAction(winner, citation.query),
      });
    }
  }

  // Sort by potential impact (prioritize queries where we're completely absent)
  gaps.sort((a, b) => {
    if (a.yourPosition === "absent" && b.yourPosition !== "absent") return -1;
    if (a.yourPosition !== "absent" && b.yourPosition === "absent") return 1;
    return 0;
  });

  return gaps;
}

/**
 * Analyze why the winner is winning
 */
function analyzeWinnerContent(
  winner: TavilySearchResult["results"][0],
  query: string,
): string {
  const reasons: string[] = [];

  // Check title match
  const queryWords = query
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 3);
  const titleWords = winner.title.toLowerCase();
  const titleMatches = queryWords.filter((w) => titleWords.includes(w)).length;

  if (titleMatches >= queryWords.length * 0.6) {
    reasons.push("Title directly addresses query");
  }

  // Check content depth
  if (winner.content.length > 400) {
    reasons.push("Comprehensive content");
  }

  // Check for structured content indicators
  if (winner.content.includes("1.") || winner.content.includes("Step ")) {
    reasons.push("Step-by-step format");
  }

  if (reasons.length === 0) {
    reasons.push("Better overall relevance");
  }

  return reasons.join("; ");
}

/**
 * Generate suggested action to win this query
 */
function generateSuggestedAction(
  winner: TavilySearchResult["results"][0],
  query: string,
): string {
  const queryType = classifyQueryType(query);

  const actions: Record<string, string> = {
    "how-to": "Create a step-by-step guide that directly answers this question",
    "what-is": "Add a clear definition/explanation section",
    comparison: "Add a comparison table or detailed comparison section",
    best: "Include a curated list with recommendations and reasoning",
    why: "Add an explanatory section addressing the reasoning",
    other: "Create dedicated content targeting this specific query",
  };

  return (
    actions[queryType] ??
    actions.other ??
    "Create dedicated content targeting this specific query"
  );
}

/**
 * Generate key findings from the analysis
 */
function generateFindings(
  metrics: ReturnType<typeof calculateBasicMetrics>,
  patterns: { winning: Map<string, number>; losing: Map<string, number> },
  gaps: QueryGap[],
): string[] {
  const findings: string[] = [];

  // Overall visibility finding
  if (metrics.citationRate >= 70) {
    findings.push(
      `Strong visibility: Your domain appears in ${Math.round(metrics.citationRate)}% of relevant searches`,
    );
  } else if (metrics.citationRate >= 40) {
    findings.push(
      `Moderate visibility: Your domain appears in ${Math.round(metrics.citationRate)}% of relevant searches - room for improvement`,
    );
  } else {
    findings.push(
      `Low visibility: Your domain only appears in ${Math.round(metrics.citationRate)}% of relevant searches`,
    );
  }

  // Top 3 ranking finding
  if (metrics.top3Rate >= 50) {
    findings.push(
      `Strong rankings: You rank in top 3 for ${Math.round(metrics.top3Rate)}% of queries`,
    );
  } else if (metrics.top3Rate > 0) {
    findings.push(
      `Ranking opportunity: Only ${Math.round(metrics.top3Rate)}% of queries have you in top 3`,
    );
  }

  // Query type patterns
  const bestPerformingType = [...patterns.winning.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const worstPerformingType = [...patterns.losing.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];

  if (bestPerformingType) {
    findings.push(
      `Best performing query type: "${bestPerformingType[0]}" queries (${bestPerformingType[1]} wins)`,
    );
  }
  if (worstPerformingType && worstPerformingType[1] >= 2) {
    findings.push(
      `Weakest query type: "${worstPerformingType[0]}" queries (missing ${worstPerformingType[1]} opportunities)`,
    );
  }

  // Gap analysis
  const firstGap = gaps[0];
  if (firstGap) {
    const topCompetitor = firstGap.winningDomain;
    const competitorWins = gaps.filter(
      (g) => g.winningDomain === topCompetitor,
    ).length;
    if (competitorWins >= 2) {
      findings.push(
        `Key competitor: ${topCompetitor} wins ${competitorWins} queries you're missing`,
      );
    }
  }

  return findings;
}
