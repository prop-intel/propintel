/**
 * Recommendation Agent
 *
 * Generates prioritized, actionable recommendations
 * based on AEO analysis results.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { type AEOAnalysis, type AEORecommendation, type QueryGap, type CompetitorVisibility } from '../../types';
import { type ContentComparisonResult } from '../analysis/content-comparison';
import { createTrace, safeFlush } from '../../lib/langfuse';

// Agent name for logging
const AGENT_NAME = 'Recommendations Agent';

// ===================
// Timeout Configuration
// ===================

// 60 second timeout for LLM API calls to prevent indefinite hangs
const LLM_TIMEOUT_MS = 60_000;

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ===================
// Schema Definition
// ===================

const RecommendationSchema = z.object({
  title: z.string().describe('Clear, actionable title'),
  description: z.string().describe('Detailed description of what to do'),
  impact: z.string().describe('Expected impact on visibility'),
  effort: z.string().describe('Implementation effort (low, medium, high)'),
  category: z.string().describe('Category of improvement (visibility, content, structure, authority)'),
  priority: z.string().describe('Priority level (high, medium, low)'),
  targetQueries: z.array(z.string()).optional()
    .describe('Specific queries this will help win'),
});

// Normalize recommendation data
function normalizeRecommendation(data: z.infer<typeof RecommendationSchema>) {
  return {
    title: data.title,
    description: data.description,
    impact: data.impact,
    effort: (data.effort?.toLowerCase() || 'medium') as 'low' | 'medium' | 'high',
    category: (data.category?.toLowerCase() || 'content') as 'visibility' | 'content' | 'structure' | 'authority',
    priority: (data.priority?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
    targetQueries: data.targetQueries ?? [],
  };
}

const RecommendationsSchema = z.object({
  recommendations: z.array(RecommendationSchema),
});

// ===================
// Main Function
// ===================

/**
 * Generate prioritized recommendations based on AEO analysis
 */
export async function generateAEORecommendations(
  aeoAnalysis: AEOAnalysis,
  contentComparison: ContentComparisonResult,
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<AEORecommendation[]> {
  console.log(`[${AGENT_NAME}] Starting recommendation generation`);
  console.log(`[${AGENT_NAME}] Input data:`);
  console.log(`[${AGENT_NAME}]   - Visibility Score: ${aeoAnalysis.visibilityScore}/100`);
  console.log(`[${AGENT_NAME}]   - Citation Rate: ${Math.round(aeoAnalysis.citationRate)}%`);
  console.log(`[${AGENT_NAME}]   - Queries Analyzed: ${aeoAnalysis.queriesAnalyzed}`);
  console.log(`[${AGENT_NAME}]   - Content Gaps: ${contentComparison.contentGaps.length}`);
  console.log(`[${AGENT_NAME}]   - Competitors: ${aeoAnalysis.competitors.length}`);
  console.log(`[${AGENT_NAME}]   - Model: ${model}`);

  const trace = createTrace({
    name: 'aeo-recommendations',
    userId: tenantId,
    metadata: { jobId },
  });

  const generation = trace.generation({
    name: 'generate-recommendations',
    model,
  });

  try {
    // Build context for LLM (used for logging/debugging if needed)
    buildRecommendationContext(aeoAnalysis, contentComparison);

    console.log(`[${AGENT_NAME}] Calling LLM (timeout: ${LLM_TIMEOUT_MS / 1000}s)...`);
    const startTime = Date.now();

    const systemPrompt = `You are an expert AEO (Answer Engine Optimization) consultant.
Generate specific, actionable recommendations to improve visibility in AI search results.

Focus on:
1. Quick wins that can be implemented immediately
2. High-impact changes that will significantly improve visibility
3. Content improvements to better match winning competitors
4. Structural changes to make content more AI-friendly

Be specific - mention exact queries, competitor examples, and concrete changes.
Prioritize recommendations that address the biggest gaps.`;

    const userPrompt = `Generate AEO recommendations based on this analysis:

Visibility Score: ${aeoAnalysis.visibilityScore}/100
Citation Rate: ${Math.round(aeoAnalysis.citationRate)}%

Key Findings:
${aeoAnalysis.keyFindings.map(f => `- ${f}`).join('\n')}

Top Performing Queries (you're winning these):
${aeoAnalysis.topPerformingQueries.map(q => `- ${q}`).join('\n') || '- None'}

Missed Opportunities (you're not appearing for these):
${aeoAnalysis.missedOpportunities.map(q => `- ${q}`).join('\n') || '- None'}

Content Gaps Identified:
${contentComparison.contentGaps.map(g => `- ${g.topic}: ${g.description} (${g.priority} priority)`).join('\n')}

Top Competitors:
${aeoAnalysis.competitors.slice(0, 3).map(c => 
  `- ${c.domain}: ${Math.round(c.citationRate)}% citation rate, strengths: ${c.strengths.join(', ')}`
).join('\n')}

Generate 5-8 specific, prioritized recommendations.`;

    const result = await generateObject({
      model: openai(model),
      schema: RecommendationsSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${AGENT_NAME}] LLM call completed in ${duration}s`);
    console.log(`[${AGENT_NAME}] Generated ${result.object.recommendations.length} recommendations`);
    console.log(`[${AGENT_NAME}] Token usage: ${result.usage?.promptTokens} prompt, ${result.usage?.completionTokens} completion`);

    generation.end({
      output: result.object,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    // Non-blocking flush - observability should never block business logic
    void safeFlush();

    // Add IDs and competitor examples, normalize enum values
    console.log(`[${AGENT_NAME}] Processing and normalizing recommendations...`);
    const recommendations: AEORecommendation[] = result.object.recommendations.map((rec, index) => {
      const normalized = normalizeRecommendation(rec);
      return {
        ...normalized,
        id: `aeo-rec-${index + 1}`,
        competitorExample: findCompetitorExample(normalized, aeoAnalysis.competitors, aeoAnalysis.gaps),
      };
    });

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    console.log(`[${AGENT_NAME}] ✅ Complete! Returning ${recommendations.length} prioritized recommendations`);
    const highPriority = recommendations.filter(r => r.priority === 'high').length;
    const mediumPriority = recommendations.filter(r => r.priority === 'medium').length;
    const lowPriority = recommendations.filter(r => r.priority === 'low').length;
    console.log(`[${AGENT_NAME}]   - High priority: ${highPriority}`);
    console.log(`[${AGENT_NAME}]   - Medium priority: ${mediumPriority}`);
    console.log(`[${AGENT_NAME}]   - Low priority: ${lowPriority}`);

    return recommendations;
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[${AGENT_NAME}] ❌ Error: ${errorMessage}`);
    
    // Check for timeout
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      console.error(`[${AGENT_NAME}] LLM call timed out after ${LLM_TIMEOUT_MS / 1000}s`);
    }
    
    generation.end({
      output: null,
      level: 'ERROR',
      statusMessage: errorMessage,
    });
    // Non-blocking flush - still try to log errors
    void safeFlush();
    throw error;
  }
}

/**
 * Generate quick recommendations without LLM (rule-based)
 */
export function generateQuickRecommendations(
  aeoAnalysis: AEOAnalysis
): AEORecommendation[] {
  const recommendations: AEORecommendation[] = [];
  let idCounter = 1;

  // Low citation rate
  if (aeoAnalysis.citationRate < 30) {
    recommendations.push({
      id: `quick-${idCounter++}`,
      priority: 'high',
      category: 'visibility',
      title: 'Improve overall content relevance',
      description: 'Your content appears in less than 30% of relevant searches. Review your content to ensure it directly answers common questions in your topic area.',
      impact: 'Could significantly increase visibility',
      effort: 'medium',
      targetQueries: aeoAnalysis.missedOpportunities.slice(0, 3),
    });
  }

  // Missing from many queries
  if (aeoAnalysis.gaps.length >= 5) {
    recommendations.push({
      id: `quick-${idCounter++}`,
      priority: 'high',
      category: 'content',
      title: 'Address content gaps',
      description: `You're missing from ${aeoAnalysis.gaps.length} relevant searches. Create or expand content to cover these topics.`,
      impact: 'Each addressed gap could add visibility',
      effort: 'high',
      targetQueries: aeoAnalysis.gaps.slice(0, 5).map(g => g.query),
    });
  }

  // Competitor dominance
  const topCompetitor = aeoAnalysis.competitors[0];
  if (topCompetitor && topCompetitor.citationRate > aeoAnalysis.citationRate * 2) {
    recommendations.push({
      id: `quick-${idCounter++}`,
      priority: 'high',
      category: 'authority',
      title: `Study what ${topCompetitor.domain} is doing`,
      description: `${topCompetitor.domain} appears in ${Math.round(topCompetitor.citationRate)}% of searches vs your ${Math.round(aeoAnalysis.citationRate)}%. Analyze their content structure and approach.`,
      impact: 'Learn from market leader',
      effort: 'low',
      targetQueries: topCompetitor.topQueries,
      competitorExample: {
        domain: topCompetitor.domain,
        url: '',
        whatTheyDoBetter: topCompetitor.strengths.join(', '),
      },
    });
  }

  // Few top 3 rankings
  const top3Queries = aeoAnalysis.citations
    .filter(c => c.yourRank && c.yourRank <= 3)
    .map(c => c.query);

  if (top3Queries.length < aeoAnalysis.queriesAnalyzed * 0.3) {
    recommendations.push({
      id: `quick-${idCounter++}`,
      priority: 'medium',
      category: 'structure',
      title: 'Improve content structure for top rankings',
      description: 'You appear in searches but rarely in top 3 positions. Improve content structure with clear headings, direct answers, and comprehensive coverage.',
      impact: 'Better rankings mean more AI citations',
      effort: 'medium',
      targetQueries: aeoAnalysis.citations
        .filter(c => c.yourRank && c.yourRank > 3)
        .slice(0, 5)
        .map(c => c.query),
    });
  }

  return recommendations;
}

// ===================
// Helper Functions
// ===================

/**
 * Build context for recommendation generation
 */
function buildRecommendationContext(
  aeoAnalysis: AEOAnalysis,
  contentComparison: ContentComparisonResult
): string {
  return `
Visibility Score: ${aeoAnalysis.visibilityScore}
Citation Rate: ${aeoAnalysis.citationRate}%
Queries Analyzed: ${aeoAnalysis.queriesAnalyzed}
Gaps Found: ${aeoAnalysis.gaps.length}
Top Competitors: ${aeoAnalysis.competitors.slice(0, 3).map(c => c.domain).join(', ')}
Content Gaps: ${contentComparison.contentGaps.map(g => g.topic).join(', ')}
`;
}

/**
 * Find a relevant competitor example for a recommendation
 */
function findCompetitorExample(
  recommendation: { targetQueries: string[] },
  competitors: CompetitorVisibility[],
  gaps: QueryGap[]
): AEORecommendation['competitorExample'] | undefined {
  // Find a gap that matches one of the target queries
  for (const query of recommendation.targetQueries) {
    const gap = gaps.find(g => g.query === query);
    if (gap) {
      return {
        domain: gap.winningDomain,
        url: gap.winningUrl,
        whatTheyDoBetter: gap.winningReason,
      };
    }
  }

  // Fall back to top competitor
  const firstCompetitor = competitors[0];
  if (firstCompetitor) {
    return {
      domain: firstCompetitor.domain,
      url: '',
      whatTheyDoBetter: firstCompetitor.strengths.join(', '),
    };
  }

  return undefined;
}

