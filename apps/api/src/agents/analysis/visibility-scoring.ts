/**
 * Visibility Scoring Agent
 *
 * Calculates the AEO Visibility Score - the primary metric
 * for measuring how well content appears in AI search results.
 */

import { Langfuse } from 'langfuse';
import { QueryCitation, CompetitorVisibility, AEOAnalysis, PageAnalysis, TargetQuery, TavilySearchResult, QueryGap } from '../../types';
import { CitationAnalysisResult } from './citation-analysis';
import { ContentComparisonResult } from './content-comparison';

// ===================
// Configuration
// ===================

// Score weights
const WEIGHTS = {
  citationRate: 0.35,      // How often you appear
  rankQuality: 0.25,       // Position when you do appear
  competitivePosition: 0.20, // How you compare to competitors
  queryBreadth: 0.10,      // Coverage across different query types
  gapPenalty: 0.10,        // Penalty for missed opportunities
};

// ===================
// Client Initialization
// ===================

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  secretKey: process.env.LANGFUSE_SECRET_KEY || '',
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
});

// ===================
// Main Function
// ===================

/**
 * Calculate the comprehensive AEO Visibility Score
 */
export async function calculateVisibilityScore(
  citationAnalysis: CitationAnalysisResult,
  competitors: CompetitorVisibility[],
  contentComparison: ContentComparisonResult,
  tenantId: string,
  jobId: string
): Promise<{
  score: number;
  breakdown: ScoreBreakdown;
  grade: string;
  summary: string;
}> {
  const trace = langfuse.trace({
    name: 'aeo-visibility-scoring',
    userId: tenantId,
    metadata: { jobId },
  });

  const span = trace.span({
    name: 'calculate-score',
  });

  try {
    // Calculate component scores
    const citationScore = calculateCitationScore(citationAnalysis);
    const rankScore = calculateRankScore(citationAnalysis);
    const competitiveScore = calculateCompetitiveScore(citationAnalysis, competitors);
    const breadthScore = calculateBreadthScore(citationAnalysis);
    const gapPenalty = calculateGapPenalty(citationAnalysis.gaps, citationAnalysis.totalQueries);

    // Calculate weighted total
    const totalScore = Math.round(
      citationScore * WEIGHTS.citationRate +
      rankScore * WEIGHTS.rankQuality +
      competitiveScore * WEIGHTS.competitivePosition +
      breadthScore * WEIGHTS.queryBreadth -
      gapPenalty * WEIGHTS.gapPenalty
    );

    // Clamp to 0-100
    const finalScore = Math.max(0, Math.min(100, totalScore));

    const breakdown: ScoreBreakdown = {
      citationRate: {
        score: citationScore,
        weight: WEIGHTS.citationRate,
        contribution: Math.round(citationScore * WEIGHTS.citationRate),
      },
      rankQuality: {
        score: rankScore,
        weight: WEIGHTS.rankQuality,
        contribution: Math.round(rankScore * WEIGHTS.rankQuality),
      },
      competitivePosition: {
        score: competitiveScore,
        weight: WEIGHTS.competitivePosition,
        contribution: Math.round(competitiveScore * WEIGHTS.competitivePosition),
      },
      queryBreadth: {
        score: breadthScore,
        weight: WEIGHTS.queryBreadth,
        contribution: Math.round(breadthScore * WEIGHTS.queryBreadth),
      },
      gapPenalty: {
        score: gapPenalty,
        weight: WEIGHTS.gapPenalty,
        contribution: -Math.round(gapPenalty * WEIGHTS.gapPenalty),
      },
    };

    const grade = getGrade(finalScore);
    const summary = generateScoreSummary(finalScore, breakdown, citationAnalysis);

    span.end({
      output: { score: finalScore, grade },
    });

    await langfuse.flushAsync();

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
    await langfuse.flushAsync();
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
  citationAnalysis: CitationAnalysisResult
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
  const winningTypes = analysis.queryTypesWinning.size;
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
  analysis: CitationAnalysisResult
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
  const topContributor = Object.entries(breakdown)
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

