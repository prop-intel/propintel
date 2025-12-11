/**
 * Page Analysis Agent
 *
 * Analyzes crawled page content to extract:
 * - Topic and subject matter
 * - User intent
 * - Key entities mentioned
 * - Content type classification
 * - Summary and key points
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { type CrawledPage, type PageAnalysis } from '../../types';
import { createTrace, flushLangfuse } from '../../lib/langfuse';

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ===================
// Schema Definition
// ===================

const PageAnalysisSchema = z.object({
  topic: z.string().describe('The main topic or subject of the page'),
  intent: z.string().describe('The primary user intent (informational, transactional, navigational, commercial)'),
  entities: z.array(z.string()).optional()
    .describe('Key entities, concepts, products, or technologies mentioned'),
  contentType: z.string().describe('The type of content (article, product, landing, documentation, blog, other)'),
  summary: z.string()
    .describe('A 2-3 sentence summary of what the page is about'),
  keyPoints: z.array(z.string()).optional()
    .describe('The main points or takeaways from the page (3-5 items)'),
});

// Normalize page analysis result
function normalizePageAnalysis(data: z.infer<typeof PageAnalysisSchema>) {
  return {
    topic: data.topic,
    intent: (data.intent?.toLowerCase() || 'informational') as 'informational' | 'transactional' | 'navigational' | 'commercial',
    entities: data.entities ?? [],
    contentType: (data.contentType?.toLowerCase() || 'other') as 'article' | 'product' | 'landing' | 'documentation' | 'blog' | 'other',
    summary: data.summary,
    keyPoints: data.keyPoints ?? [],
  };
}

// ===================
// Main Function
// ===================

/**
 * Analyze a crawled page to extract topic, intent, entities, and key information
 */
export async function analyzePageContent(
  page: CrawledPage,
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<PageAnalysis> {
  const trace = createTrace({
    name: 'aeo-page-analysis',
    userId: tenantId,
    metadata: { jobId, url: page.url },
  });

  const generation = trace.generation({
    name: 'page-analysis-generation',
    model,
    input: { url: page.url, title: page.title },
  });

  try {
    // Build content context from crawled page
    const contentContext = buildContentContext(page);

    const systemPrompt = `You are an expert content analyst specializing in SEO and AI answer optimization.
Analyze the provided web page content and extract structured information about its topic, intent, and key elements.

Be specific and accurate. Focus on what would help AI systems understand and cite this content.`;

    const userPrompt = `Analyze this web page:

URL: ${page.url}
Title: ${page.title || 'No title'}
Meta Description: ${page.metaDescription || 'None'}

Headings:
${formatHeadings(page.headings)}

Content Summary (first 2000 chars):
${contentContext.slice(0, 2000)}

Word Count: ${page.wordCount}
Schema Types Found: ${page.schemas.map(s => s.type).join(', ') || 'None'}

Extract the topic, intent, entities, content type, summary, and key points.`;

    const result = await generateObject({
      model: openai(model),
      schema: PageAnalysisSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
    });

    const normalized = normalizePageAnalysis(result.object);

    generation.end({
      output: normalized,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    await flushLangfuse();

    return normalized as PageAnalysis;
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

/**
 * Analyze multiple pages and return consolidated analysis
 * Uses the most informative page (usually homepage or main content page)
 */
export async function analyzePages(
  pages: CrawledPage[],
  tenantId: string,
  jobId: string,
  model = 'gpt-4o-mini'
): Promise<PageAnalysis> {
  // Find the best page to analyze (prefer homepage or page with most content)
  const bestPage = selectBestPage(pages);
  
  return analyzePageContent(bestPage, tenantId, jobId, model);
}

// ===================
// Helper Functions
// ===================

/**
 * Select the best page for analysis
 */
function selectBestPage(pages: CrawledPage[]): CrawledPage {
  if (pages.length === 0) {
    throw new Error('No pages to analyze');
  }

  // Score each page
  const scored = pages.map(page => ({
    page,
    score: calculatePageScore(page),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) {
    throw new Error('No pages to analyze');
  }
  return best.page;
}

/**
 * Calculate a score for page quality/informativeness
 */
function calculatePageScore(page: CrawledPage): number {
  let score = 0;

  // Prefer pages with more content
  score += Math.min(page.wordCount / 100, 20);

  // Prefer pages with title and description
  if (page.title) score += 10;
  if (page.metaDescription) score += 5;

  // Prefer pages with structured data
  score += page.schemas.length * 3;

  // Prefer homepage
  try {
    const url = new URL(page.url);
    if (url.pathname === '/' || url.pathname === '') {
      score += 15;
    }
  } catch {
    // Ignore URL parsing errors
  }

  // Prefer pages with good heading structure
  if (page.headings.h1.length > 0) score += 5;
  if (page.headings.h2.length > 0) score += 3;

  return score;
}

/**
 * Build content context from page data
 */
function buildContentContext(page: CrawledPage): string {
  const parts: string[] = [];

  if (page.title) {
    parts.push(`Title: ${page.title}`);
  }

  if (page.metaDescription) {
    parts.push(`Description: ${page.metaDescription}`);
  }

  if (page.h1) {
    parts.push(`Main Heading: ${page.h1}`);
  }

  // Add all headings as context
  const allHeadings = [
    ...page.headings.h1,
    ...page.headings.h2,
    ...page.headings.h3,
  ];
  
  if (allHeadings.length > 0) {
    parts.push(`Key Sections: ${allHeadings.join(', ')}`);
  }

  return parts.join('\n\n');
}

/**
 * Format headings for prompt
 */
function formatHeadings(headings: CrawledPage['headings']): string {
  const lines: string[] = [];

  headings.h1.forEach(h => lines.push(`H1: ${h}`));
  headings.h2.forEach(h => lines.push(`  H2: ${h}`));
  headings.h3.slice(0, 5).forEach(h => lines.push(`    H3: ${h}`));

  if (lines.length === 0) {
    return 'No headings found';
  }

  return lines.join('\n');
}

