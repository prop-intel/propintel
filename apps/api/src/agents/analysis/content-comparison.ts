/**
 * Content Comparison Agent
 *
 * Compares your content against winning competitors
 * to identify what they're doing differently.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Langfuse } from 'langfuse';
import { type TavilySearchResult, type PageAnalysis, type CompetitorVisibility } from '../../types';

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
// Types
// ===================

export interface ContentComparisonResult {
  competitorInsights: CompetitorInsight[];
  contentGaps: ContentGap[];
  structuralDifferences: string[];
  recommendations: string[];
}

export interface CompetitorInsight {
  domain: string;
  strengths: string[];
  contentPatterns: string[];
  uniqueElements: string[];
}

export interface ContentGap {
  topic: string;
  description: string;
  competitorsCovering: string[];
  priority: 'high' | 'medium' | 'low';
}

// ===================
// Schema Definitions
// ===================

const GapSchema = z.object({
  topic: z.string(),
  description: z.string(),
  priority: z.string().describe('Priority level (high, medium, low)'),
});

const ComparisonSchema = z.object({
  competitorStrengths: z.array(z.string()).optional()
    .describe('What the competitor content does well'),
  contentPatterns: z.array(z.string()).optional()
    .describe('Common patterns in winning content'),
  gapsIdentified: z.array(GapSchema).optional()
    .describe('Content gaps to address'),
  structuralDifferences: z.array(z.string()).optional()
    .describe('Structural differences between your content and competitors'),
  recommendations: z.array(z.string()).optional()
    .describe('Specific recommendations to improve'),
});

// Normalize comparison result
function normalizeComparisonResult(data: z.infer<typeof ComparisonSchema>) {
  return {
    competitorStrengths: data.competitorStrengths ?? [],
    contentPatterns: data.contentPatterns ?? [],
    gapsIdentified: (data.gapsIdentified ?? []).map(g => ({
      topic: g.topic,
      description: g.description,
      priority: (g.priority?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
    })),
    structuralDifferences: data.structuralDifferences ?? [],
    recommendations: data.recommendations ?? [],
  };
}

// ===================
// Main Function
// ===================

/**
 * Compare your content against competitors
 */
export async function compareContent(
  yourPageAnalysis: PageAnalysis,
  competitors: CompetitorVisibility[],
  searchResults: TavilySearchResult[],
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<ContentComparisonResult> {
  const trace = langfuse.trace({
    name: 'aeo-content-comparison',
    userId: tenantId,
    metadata: { jobId, competitorCount: competitors.length },
  });

  const generation = trace.generation({
    name: 'content-comparison',
    model,
  });

  try {
    // Extract competitor content snippets from search results
    const competitorContent = extractCompetitorContent(competitors, searchResults);

    const systemPrompt = `You are an expert content strategist analyzing why competitor content ranks better in AI search results.

Compare the user's page content against competitor snippets and identify:
1. What competitors do better
2. Common patterns in winning content
3. Content gaps the user should fill
4. Structural differences that affect rankings
5. Specific, actionable recommendations

Focus on actionable insights that would help AI systems better understand and cite the content.`;

    const userPrompt = `Your Page Analysis:
Topic: ${yourPageAnalysis.topic}
Content Type: ${yourPageAnalysis.contentType}
Key Points: ${yourPageAnalysis.keyPoints.join('; ')}
Summary: ${yourPageAnalysis.summary}

Top Competitors and Their Content:
${competitorContent.map(c => `
--- ${c.domain} ---
Appears in ${c.citationCount} queries
Sample content: ${c.contentSnippets.slice(0, 2).join('\n')}
`).join('\n')}

Analyze what competitors are doing better and what content gaps exist.`;

    const result = await generateObject({
      model: openai(model),
      schema: ComparisonSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
    });

    const normalized = normalizeComparisonResult(result.object);

    generation.end({
      output: normalized,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    await langfuse.flushAsync();

    // Transform to our format
    const comparisonResult: ContentComparisonResult = {
      competitorInsights: competitors.slice(0, 5).map(c => ({
        domain: c.domain,
        strengths: normalized.competitorStrengths,
        contentPatterns: normalized.contentPatterns,
        uniqueElements: c.strengths,
      })),
      contentGaps: normalized.gapsIdentified.map(g => ({
        ...g,
        competitorsCovering: competitors.slice(0, 3).map(c => c.domain),
      })),
      structuralDifferences: normalized.structuralDifferences,
      recommendations: normalized.recommendations,
    };

    return comparisonResult;
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
 * Quick comparison without LLM (faster, less detailed)
 */
export function quickCompare(
  competitors: CompetitorVisibility[],
  searchResults: TavilySearchResult[]
): {
  topCompetitors: string[];
  commonPatterns: string[];
  dominantDomains: Map<string, number>;
} {
  // Find domains that appear most frequently in top positions
  const topPositionCounts = new Map<string, number>();
  
  for (const result of searchResults) {
    for (let i = 0; i < Math.min(3, result.results.length); i++) {
      const domain = result.results[i].domain;
      topPositionCounts.set(domain, (topPositionCounts.get(domain) || 0) + 1);
    }
  }

  // Identify common patterns in winning content
  const patterns: string[] = [];
  const allTitles = searchResults.flatMap(r => r.results.slice(0, 3).map(res => res.title));
  
  // Check for common title patterns
  const hasHowTo = allTitles.some(t => t.toLowerCase().includes('how to'));
  const hasGuide = allTitles.some(t => t.toLowerCase().includes('guide'));
  const hasList = allTitles.some(t => /\d+/.test(t)); // Contains numbers (listicles)
  const hasYear = allTitles.some(t => /202\d/.test(t)); // Contains year

  if (hasHowTo) patterns.push('How-to format');
  if (hasGuide) patterns.push('Comprehensive guides');
  if (hasList) patterns.push('Numbered lists/listicles');
  if (hasYear) patterns.push('Updated/dated content');

  return {
    topCompetitors: competitors.slice(0, 5).map(c => c.domain),
    commonPatterns: patterns,
    dominantDomains: topPositionCounts,
  };
}

// ===================
// Helper Functions
// ===================

/**
 * Extract content snippets for top competitors
 */
function extractCompetitorContent(
  competitors: CompetitorVisibility[],
  searchResults: TavilySearchResult[]
): Array<{
  domain: string;
  citationCount: number;
  contentSnippets: string[];
}> {
  const competitorContent: Array<{
    domain: string;
    citationCount: number;
    contentSnippets: string[];
  }> = [];

  for (const competitor of competitors.slice(0, 5)) {
    const snippets: string[] = [];

    for (const result of searchResults) {
      for (const item of result.results) {
        if (item.domain === competitor.domain && snippets.length < 3) {
          snippets.push(`[${item.title}] ${item.content.slice(0, 200)}...`);
        }
      }
    }

    competitorContent.push({
      domain: competitor.domain,
      citationCount: competitor.citationCount,
      contentSnippets: snippets,
    });
  }

  return competitorContent;
}

