import { createOpenAI } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { Langfuse } from 'langfuse';
import { type CrawledPage, type LLMEOAnalysis, type SEOAnalysis, type Recommendation } from '../types';

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Only initialize Langfuse if credentials are configured
const langfuse = process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
  ? new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
    })
  : null;

// Helper to create a no-op trace when Langfuse is not configured
const createTrace = (config: { name: string; userId: string; metadata?: Record<string, unknown> }) => {
  if (langfuse) {
    return langfuse.trace(config);
  }
  // Return a no-op trace object
  return {
    generation: () => ({
      end: () => { /* no-op when Langfuse not configured */ },
    }),
  };
};

const flushLangfuse = async () => {
  if (langfuse) {
    await langfuse.flushAsync();
  }
};

// ===================
// Schema Definitions
// ===================

const SummarySchema = z.object({
  strengths: z.array(z.string()).describe('Key strengths of the site'),
  weaknesses: z.array(z.string()).describe('Key weaknesses to address'),
  opportunities: z.array(z.string()).describe('Opportunities for improvement'),
  nextSteps: z.array(z.string()).describe('Prioritized next steps'),
});

// Case-insensitive enum helper
const caseInsensitiveEnum = <T extends string>(values: readonly T[]) =>
  z.string().transform((val) => val.toLowerCase() as T).pipe(z.enum(values as unknown as readonly [T, ...T[]]));

const RecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  effort: caseInsensitiveEnum(['low', 'medium', 'high'] as const),
  category: caseInsensitiveEnum(['llmeo', 'seo', 'content', 'technical'] as const),
  priority: caseInsensitiveEnum(['high', 'medium', 'low'] as const),
  codeSnippet: z.string().optional(),
});

const RecommendationsSchema = z.object({
  recommendations: z.array(RecommendationSchema),
});

const CopyReadyPromptSchema = z.object({
  prompt: z.string().describe('Copy-ready prompt for content improvement'),
});

// ===================
// Analysis Functions
// ===================

export async function generateSummary(
  pages: CrawledPage[],
  llmeoAnalysis: LLMEOAnalysis,
  seoAnalysis: SEOAnalysis,
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<{
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  nextSteps: string[];
}> {
  const trace = createTrace({
    name: 'generate-summary',
    userId: tenantId,
    metadata: { jobId },
  });

  const generation = trace.generation({
    name: 'summary-generation',
    model,
    input: { pagesCount: pages.length, llmeoScore: llmeoAnalysis.score, seoScore: seoAnalysis.score },
  });

  try {
    const systemPrompt = `You are an expert SEO and LLMEO analyst. Analyze the provided data and generate a structured summary of the website's strengths, weaknesses, opportunities, and recommended next steps.

Focus on:
- LLMEO (LLM Engine Optimization): Schema markup, semantic clarity, content structure for AI crawlers
- Traditional SEO: Indexability, metadata, performance
- Content quality and freshness

Be specific and actionable. Reference actual findings from the analysis.`;

    const userPrompt = `Analyze this website based on the following data:

Pages Crawled: ${pages.length}

LLMEO Analysis:
- Overall Score: ${llmeoAnalysis.score}/100
- Schema Score: ${llmeoAnalysis.schemaAnalysis.score}/100
- Schemas Found: ${llmeoAnalysis.schemaAnalysis.schemasFound.join(', ') || 'None'}
- Missing Recommended Schemas: ${llmeoAnalysis.schemaAnalysis.missingRecommended.join(', ') || 'None'}
- Content Depth Score: ${llmeoAnalysis.contentDepth.score}/100
- Thin Content Pages: ${llmeoAnalysis.contentDepth.thinContentPages.length}
- Freshness Score: ${llmeoAnalysis.freshness.score}/100
- Stale Pages: ${llmeoAnalysis.freshness.stalePages.length}

SEO Analysis:
- Overall Score: ${seoAnalysis.score}/100
- Indexability Score: ${seoAnalysis.indexability.score}/100
- Noindex Pages: ${seoAnalysis.indexability.noindexPages.length}
- Missing Titles: ${seoAnalysis.metadata.missingTitles.length}
- Missing Descriptions: ${seoAnalysis.metadata.missingDescriptions.length}
- Images without Alt: ${seoAnalysis.images.missingAlt.length}
- Average Load Time: ${seoAnalysis.performance.averageLoadTime}ms

Generate a comprehensive summary with specific, actionable insights.`;

    const result = await generateObject({
      model: openai(model),
      schema: SummarySchema,
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

    await flushLangfuse();

    return result.object;
  } catch (error) {
    generation.end({
      output: null,
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await flushLangfuse();
    throw error;
  }
}

export async function generateRecommendations(
  pages: CrawledPage[],
  llmeoAnalysis: LLMEOAnalysis,
  seoAnalysis: SEOAnalysis,
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<Recommendation[]> {
  const trace = createTrace({
    name: 'generate-recommendations',
    userId: tenantId,
    metadata: { jobId },
  });

  const generation = trace.generation({
    name: 'recommendations-generation',
    model,
    input: { pagesCount: pages.length },
  });

  try {
    const systemPrompt = `You are an expert SEO and LLMEO consultant. Generate specific, actionable recommendations based on the analysis data.

For each recommendation:
1. Be specific about which pages or elements need attention
2. Provide copy-ready code snippets when applicable (especially for schema markup)
3. Estimate the impact and effort required
4. Prioritize based on potential SEO/LLMEO improvement

Focus on high-impact, achievable improvements first.`;

    const userPrompt = `Based on this analysis, generate prioritized recommendations:

LLMEO Issues:
- Missing schemas: ${llmeoAnalysis.schemaAnalysis.missingRecommended.join(', ') || 'None'}
- Invalid schemas: ${llmeoAnalysis.schemaAnalysis.invalidSchemas.join(', ') || 'None'}
- Thin content pages: ${llmeoAnalysis.contentDepth.thinContentPages.slice(0, 5).join(', ') || 'None'}
- Stale pages: ${llmeoAnalysis.freshness.stalePages.slice(0, 5).join(', ') || 'None'}

SEO Issues:
- Missing titles: ${seoAnalysis.metadata.missingTitles.slice(0, 5).join(', ') || 'None'}
- Missing descriptions: ${seoAnalysis.metadata.missingDescriptions.slice(0, 5).join(', ') || 'None'}
- Missing H1: ${seoAnalysis.structure.missingH1.slice(0, 5).join(', ') || 'None'}
- Images without alt: ${seoAnalysis.images.missingAlt.slice(0, 5).join(', ') || 'None'}
- Slow pages (>3s): ${seoAnalysis.performance.slowPages.slice(0, 5).join(', ') || 'None'}

Generate 5-10 prioritized recommendations with code snippets where applicable.`;

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

    await flushLangfuse();

    // Add IDs and affected pages, normalize enum values to lowercase
    return result.object.recommendations.map((rec, index) => ({
      ...rec,
      id: `rec-${index + 1}`,
      effort: (rec.effort?.toLowerCase() || 'medium') as 'low' | 'medium' | 'high',
      priority: (rec.priority?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
      category: (rec.category?.toLowerCase() || 'seo') as 'llmeo' | 'seo' | 'content' | 'technical',
      affectedPages: [], // Would be populated from analysis
    }));
  } catch (error) {
    generation.end({
      output: null,
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await flushLangfuse();
    throw error;
  }
}

export async function generateCopyReadyPrompt(
  domain: string,
  summary: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    nextSteps: string[];
  },
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<string> {
  const trace = createTrace({
    name: 'generate-copy-prompt',
    userId: tenantId,
    metadata: { jobId },
  });

  const generation = trace.generation({
    name: 'copy-prompt-generation',
    model,
  });

  try {
    const systemPrompt = `You are a content strategist. Create a single, comprehensive prompt that a content team could use to improve their website based on the analysis.

The prompt should:
1. Be actionable and specific
2. Address the key weaknesses and opportunities
3. Build on existing strengths
4. Be suitable for use with AI writing assistants`;

    const userPrompt = `Create a copy-ready prompt for ${domain} based on:

Strengths: ${summary.strengths.join('; ')}
Weaknesses: ${summary.weaknesses.join('; ')}
Opportunities: ${summary.opportunities.join('; ')}
Next Steps: ${summary.nextSteps.join('; ')}

Generate a comprehensive prompt that the content team can use to improve their site.`;

    const result = await generateObject({
      model: openai(model),
      schema: CopyReadyPromptSchema,
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

    await flushLangfuse();

    return result.object.prompt;
  } catch (error) {
    generation.end({
      output: null,
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    await flushLangfuse();
    throw error;
  }
}

// ===================
// Language Detection
// ===================

export async function detectLanguage(
  text: string,
  model = 'gpt-4o-mini'
): Promise<string> {
  const result = await generateText({
    model: openai(model),
    prompt: `Detect the primary language of this text and respond with only the ISO 639-1 language code (e.g., "en", "es", "fr"):

${text.slice(0, 1000)}`,
    temperature: 0,
    maxTokens: 10,
  });

  return result.text.trim().toLowerCase().slice(0, 2);
}

