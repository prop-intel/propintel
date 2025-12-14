/**
 * Visibility Scoring Agent
 *
 * Calculates the AEO Visibility Score - the primary metric
 * for measuring how well content appears in AI search results.
 */

import { type QueryCitation, type CompetitorVisibility, type AEOAnalysis, type PageAnalysis, type TargetQuery, type TavilySearchResult, type QueryGap, type CommunityEngagementResult } from '../../types';
import { type CitationAnalysisResult } from './citation-analysis';
import { type ContentComparisonResult } from './content-comparison';
import { createTrace, flushLangfuse } from '../../lib/langfuse';

// ===================
// Configuration
// ===================

// Score weights WITHOUT GEO (legacy mode)
const WEIGHTS_LEGACY = {
  citationRate: 0.35,      // How often you appear in search
  rankQuality: 0.25,       // Position when you do appear
  competitivePosition: 0.20, // How you compare to competitors
  queryBreadth: 0.10,      // Coverage across different query types
  gapPenalty: 0.10,        // Penalty for missed opportunities
};

// Score weights WITH GEO (new mode)
const WEIGHTS_WITH_GEO = {
  citationRate: 0.28,      // How often you appear in search (reduced)
  rankQuality: 0.20,       // Position when you do appear (reduced)
  competitivePosition: 0.15, // How you compare to competitors (reduced)
  queryBreadth: 0.08,      // Coverage across different query types
  gapPenalty: 0.09,        // Penalty for missed opportunities
  geoScore: 0.20,          // NEW: LLM brand recognition score
};

// Default to legacy weights (GEO is optional)
const WEIGHTS = WEIGHTS_LEGACY;

/**
 * Helper to ensure numbers are valid (returns 0 for NaN/undefined/null)
 */
function safeNumber(value: number | undefined | null): number {
  if (value === undefined || value === null || isNaN(value)) {
    return 0;
  }
  return value;
}

// ===================
// Main Function
// ===================

/**
 * Calculate the comprehensive AEO Visibility Score
 * 
 * @param geoScore - Optional GEO score from llm-brand-probe agent (0-100).
 *                   When provided, uses updated weights that factor in LLM brand recognition.
 */
export async function calculateVisibilityScore(
  citationAnalysis: CitationAnalysisResult,
  competitors: CompetitorVisibility[],
  contentComparison: ContentComparisonResult,
  tenantId: string,
  jobId: string,
  geoScore?: number
): Promise<{
  score: number;
  breakdown: ScoreBreakdown;
  grade: string;
  summary: string;
}> {
  const trace = createTrace({
    name: 'aeo-visibility-scoring',
    userId: tenantId,
    metadata: { jobId, includesGeo: geoScore !== undefined },
  });

  const span = trace.span({
    name: 'calculate-score',
  });

  try {
    // Choose weights based on whether GEO score is available
    const weights = geoScore !== undefined ? WEIGHTS_WITH_GEO : WEIGHTS_LEGACY;
    
    // Calculate component scores (with NaN protection)
    const citationScore = safeNumber(calculateCitationScore(citationAnalysis));
    const rankScore = safeNumber(calculateRankScore(citationAnalysis));
    const competitiveScore = safeNumber(calculateCompetitiveScore(citationAnalysis, competitors));
    const breadthScore = safeNumber(calculateBreadthScore(citationAnalysis));
    const gapPenalty = safeNumber(calculateGapPenalty(citationAnalysis.gaps, citationAnalysis.totalQueries));

    // Calculate weighted total
    let totalScore = Math.round(
      citationScore * weights.citationRate +
      rankScore * weights.rankQuality +
      competitiveScore * weights.competitivePosition +
      breadthScore * weights.queryBreadth -
      gapPenalty * weights.gapPenalty
    );
    
    // Add GEO score contribution if available
    if (geoScore !== undefined && weights === WEIGHTS_WITH_GEO) {
      totalScore += Math.round(geoScore * WEIGHTS_WITH_GEO.geoScore);
    }

    // Clamp to 0-100 and ensure no NaN
    const finalScore = safeNumber(Math.max(0, Math.min(100, totalScore)));

    const breakdown: ScoreBreakdown = {
      citationRate: {
        score: citationScore,
        weight: weights.citationRate,
        contribution: Math.round(citationScore * weights.citationRate),
      },
      rankQuality: {
        score: rankScore,
        weight: weights.rankQuality,
        contribution: Math.round(rankScore * weights.rankQuality),
      },
      competitivePosition: {
        score: competitiveScore,
        weight: weights.competitivePosition,
        contribution: Math.round(competitiveScore * weights.competitivePosition),
      },
      queryBreadth: {
        score: breadthScore,
        weight: weights.queryBreadth,
        contribution: Math.round(breadthScore * weights.queryBreadth),
      },
      gapPenalty: {
        score: gapPenalty,
        weight: weights.gapPenalty,
        contribution: -Math.round(gapPenalty * weights.gapPenalty),
      },
    };
    
    // Add GEO breakdown if available
    if (geoScore !== undefined && weights === WEIGHTS_WITH_GEO) {
      breakdown.geoScore = {
        score: geoScore,
        weight: WEIGHTS_WITH_GEO.geoScore,
        contribution: Math.round(geoScore * WEIGHTS_WITH_GEO.geoScore),
      };
    }

    const grade = getGrade(finalScore);
    const summary = generateScoreSummary(finalScore, breakdown, citationAnalysis, geoScore);

    span.end({
      output: { score: finalScore, grade, geoIncluded: geoScore !== undefined },
    });

    await flushLangfuse();

    return {
      score: finalScore,
      breakdown,
      grade,
      summary,
    };
  } catch (error) {
    span.end({
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await flushLangfuse();
    throw error;
  }
}

/**
 * Build the complete AEO Analysis object
 */
export function buildAEOAnalysis(
  pageAnalysis: PageAnalysis,
  targetQueries: TargetQuery[],
  searchResults: TavilySearchResult[],
  citations: QueryCitation[],
  competitors: CompetitorVisibility[],
  gaps: QueryGap[],
  visibilityScore: number,
  citationAnalysis: CitationAnalysisResult,
  communityEngagement?: CommunityEngagementResult
): AEOAnalysis {
  return {
    // Core metrics
    visibilityScore,
    queriesAnalyzed: citations.length,
    citationCount: citationAnalysis.citedQueries + citationAnalysis.mentionedQueries,
    citationRate: citationAnalysis.citationRate,

    // Discovery results
    pageAnalysis,
    targetQueries,

    // Research results
    searchResults,

    // Analysis results
    citations,
    competitors,
    gaps,

    // Summary
    topPerformingQueries: getTopPerformingQueries(citations),
    missedOpportunities: getMissedOpportunities(citations),
    keyFindings: citationAnalysis.findings,

    // Community engagement opportunities
    communityEngagement,
  };
}

// ===================
// Score Components
// ===================

interface ScoreBreakdown {
  citationRate: { score: number; weight: number; contribution: number };
  rankQuality: { score: number; weight: number; contribution: number };
  competitivePosition: { score: number; weight: number; contribution: number };
  queryBreadth: { score: number; weight: number; contribution: number };
  gapPenalty: { score: number; weight: number; contribution: number };
  geoScore?: { score: number; weight: number; contribution: number }; // Optional GEO component
}

/**
 * Score based on citation rate (how often you appear)
 */
function calculateCitationScore(analysis: CitationAnalysisResult): number {
  // Linear scale: 100% citation rate = 100 points
  return Math.min(100, analysis.citationRate);
}

/**
 * Score based on rank quality (position when appearing)
 */
function calculateRankScore(analysis: CitationAnalysisResult): number {
  if (analysis.averageRank === 0) return 0;
  
  // Inverse scale: rank 1 = 100, rank 10 = 10
  const rankScore = Math.max(0, 110 - (analysis.averageRank * 10));
  
  // Bonus for top 3 appearances
  const top3Bonus = analysis.top3Rate * 0.3;
  
  return Math.min(100, rankScore + top3Bonus);
}

/**
 * Score based on competitive position
 */
function calculateCompetitiveScore(
  analysis: CitationAnalysisResult,
  competitors: CompetitorVisibility[]
): number {
  if (competitors.length === 0) return 50; // No competitors = neutral score

  // Compare your citation rate to top competitor
  const topCompetitorRate = competitors[0]?.citationRate || 0;
  
  if (topCompetitorRate === 0) return 100;
  
  const ratio = analysis.citationRate / topCompetitorRate;
  
  // Scale: equal = 50, double = 100, half = 25
  return Math.min(100, Math.max(0, ratio * 50));
}

/**
 * Score based on query type breadth
 */
function calculateBreadthScore(analysis: CitationAnalysisResult): number {
  // Handle both Map objects and plain objects (after JSON serialization)
  let winningTypes: number;
  if (analysis.queryTypesWinning instanceof Map) {
    winningTypes = analysis.queryTypesWinning.size;
  } else if (analysis.queryTypesWinning && typeof analysis.queryTypesWinning === 'object') {
    // After JSON serialization, Map becomes a plain object
    winningTypes = Object.keys(analysis.queryTypesWinning).length;
  } else {
    winningTypes = 0;
  }
  
  const totalTypes = 6; // how-to, what-is, comparison, best, why, other
  
  // Score based on coverage across query types
  return Math.min(100, (winningTypes / totalTypes) * 150);
}

/**
 * Calculate penalty for gaps (missed opportunities)
 */
function calculateGapPenalty(gaps: QueryGap[], totalQueries: number): number {
  if (totalQueries === 0) return 0;
  
  const gapRate = gaps.length / totalQueries;
  
  // Heavy penalty for being absent from many queries
  return Math.min(100, gapRate * 150);
}

// ===================
// Helper Functions
// ===================

/**
 * Get letter grade for score
 */
function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Generate human-readable score summary
 */
function generateScoreSummary(
  score: number,
  breakdown: ScoreBreakdown,
  analysis: CitationAnalysisResult,
  geoScore?: number
): string {
  const parts: string[] = [];

  // Overall assessment
  if (score >= 70) {
    parts.push(`Strong AEO visibility with a score of ${score}/100.`);
  } else if (score >= 50) {
    parts.push(`Moderate AEO visibility with a score of ${score}/100. Significant room for improvement.`);
  } else {
    parts.push(`Low AEO visibility with a score of ${score}/100. Immediate attention needed.`);
  }

  // Key contributor
  type BreakdownEntry = [string, { score: number; weight: number; contribution: number }];
  const topContributor = (Object.entries(breakdown) as BreakdownEntry[])
    .filter(([key]) => key !== 'gapPenalty')
    .sort((a, b) => b[1].contribution - a[1].contribution)[0];

  if (topContributor) {
    const [key, value] = topContributor;
    parts.push(`Your strongest area is ${formatComponentName(key)} (contributing ${value.contribution} points).`);
  }

  // Key issue
  if (breakdown.gapPenalty.contribution < -10) {
    parts.push(`Missing opportunities are hurting your score (${Math.abs(breakdown.gapPenalty.contribution)} point penalty).`);
  }
  
  // GEO-specific insights
  if (geoScore !== undefined) {
    if (geoScore >= 70) {
      parts.push(`Strong LLM brand recognition (GEO: ${geoScore}/100) - AI models know your brand.`);
    } else if (geoScore >= 40) {
      parts.push(`Moderate LLM brand recognition (GEO: ${geoScore}/100) - room to improve AI visibility.`);
    } else if (geoScore > 0) {
      parts.push(`Low LLM brand recognition (GEO: ${geoScore}/100) - AI models rarely mention your brand.`);
    } else {
      parts.push(`Critical: AI models don't recognize your brand (GEO: 0/100).`);
    }
  }

  return parts.join(' ');
}

/**
 * Format component name for display
 */
function formatComponentName(key: string): string {
  const names: Record<string, string> = {
    citationRate: 'citation rate',
    rankQuality: 'ranking quality',
    competitivePosition: 'competitive position',
    queryBreadth: 'query coverage',
    gapPenalty: 'gaps',
    geoScore: 'LLM brand recognition',
  };
  return names[key] || key;
}

/**
 * Get queries where you perform best
 */
function getTopPerformingQueries(citations: QueryCitation[]): string[] {
  return citations
    .filter(c => c.yourPosition === 'cited' && c.yourRank && c.yourRank <= 3)
    .map(c => c.query)
    .slice(0, 5);
}

/**
 * Get queries where you're missing
 */
function getMissedOpportunities(citations: QueryCitation[]): string[] {
  return citations
    .filter(c => c.yourPosition === 'absent')
    .map(c => c.query)
    .slice(0, 5);
}

