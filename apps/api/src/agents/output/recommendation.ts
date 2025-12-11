/**
 * Recommendation Agent
 *
 * Generates prioritized, actionable recommendations
 * based on AEO analysis results.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Langfuse } from 'langfuse';
import { AEOAnalysis, AEORecommendation, QueryGap, CompetitorVisibility } from '../../types';
import { ContentComparisonResult } from '../analysis/content-comparison';

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  secretKey: process.env.LANGFUSE_SECRET_KEY || '',
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
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
  model: string = 'gpt-4o-mini'
): Promise<AEORecommendation[]> {
  const trace = langfuse.trace({
    name: 'aeo-recommendations',
    userId: tenantId,
    metadata: { jobId },
  });

  const generation = trace.generation({
    name: 'generate-recommendations',
    model,
  });

  try {
    // Build context for LLM
    const context = buildRecommendationContext(aeoAnalysis, contentComparison);

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
    });

    generation.end({
      output: result.object,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    await langfuse.flushAsync();

    // Add IDs and competitor examples, normalize enum values
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

    return recommendations;
  } catch (error) {
    generation.end({
      output: null,
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await langfuse.flushAsync();
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
  if (aeoAnalysis.competitors.length > 0 && aeoAnalysis.competitors[0].citationRate > aeoAnalysis.citationRate * 2) {
    const topCompetitor = aeoAnalysis.competitors[0];
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
  if (competitors.length > 0) {
    return {
      domain: competitors[0].domain,
      url: '',
      whatTheyDoBetter: competitors[0].strengths.join(', '),
    };
  }

  return undefined;
}

