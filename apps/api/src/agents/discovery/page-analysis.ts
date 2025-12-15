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

import { generateObject } from 'ai';
import { z } from 'zod';
import { type CrawledPage, type PageAnalysis } from '../../types';
import { createTrace, safeFlush } from '../../lib/langfuse';
import { withProviderFallback, LLM_TIMEOUT_MS } from '../../lib/llm-utils';

// Agent name for logging
const AGENT_NAME = 'Page Analysis';

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
  
  // Business understanding fields
  companyName: z.string()
    .describe('The company or product name (e.g., "GauntletAI", "Stripe", "Notion")'),
  businessCategory: z.string()
    .describe('The business category: saas, ecommerce, education, agency, marketplace, media, fintech, healthcare, b2b-services, consumer-app, developer-tools, ai-ml, or other'),
  businessModel: z.string()
    .describe('How this business operates and acquires customers (e.g., "Intensive bootcamp program where engineers apply and enroll for AI training", "Subscription-based project management software", "E-commerce platform selling directly to consumers")'),
  competitorProfile: z.string()
    .describe('What a real business competitor would look like - another company where a customer could choose to go INSTEAD (e.g., "Other AI/ML bootcamps or training programs where engineers could apply", "Other project management SaaS tools", "Other online retailers in the same product category")'),
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
    // Business understanding
    companyName: data.companyName || '',
    businessCategory: (data.businessCategory?.toLowerCase() || 'other') as 'saas' | 'ecommerce' | 'education' | 'agency' | 'marketplace' | 'media' | 'fintech' | 'healthcare' | 'b2b-services' | 'consumer-app' | 'developer-tools' | 'ai-ml' | 'other',
    businessModel: data.businessModel || '',
    competitorProfile: data.competitorProfile || '',
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

    const systemPrompt = `You are an expert business and content analyst specializing in competitive intelligence and AI answer optimization.

Your task is to analyze a web page and understand TWO things:
1. CONTENT: What the page is about (topic, intent, key points)
2. BUSINESS: What type of company this is and who their REAL competitors would be

For business analysis, think like a customer:
- If someone is considering this company, what OTHER companies would they also be evaluating?
- A competitor is NOT just anyone who ranks for similar keywords
- A competitor IS another business where a customer could choose to spend their money/time INSTEAD

Examples of CORRECT competitor identification:
- GauntletAI (AI bootcamp) → Other AI bootcamps/training programs (NOT YouTube tutorials)
- Stripe (payment SaaS) → Other payment processors like Square, PayPal (NOT banking blogs)
- Airbnb (vacation rentals) → VRBO, Hotels.com (NOT travel blogs)
- Notion (productivity SaaS) → Coda, Confluence, Asana (NOT productivity YouTube channels)

Be specific and accurate. This analysis will be used to find ACTUAL business competitors.`;

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

Extract:
1. CONTENT ANALYSIS: topic, intent, entities, content type, summary, key points
2. BUSINESS ANALYSIS:
   - companyName: The actual company/product name
   - businessCategory: What type of business (saas, ecommerce, education, agency, marketplace, media, fintech, healthcare, b2b-services, consumer-app, developer-tools, ai-ml, other)
   - businessModel: How they operate and acquire customers (be specific)
   - competitorProfile: Describe what a REAL business competitor looks like - another company a customer would evaluate alongside this one (NOT content platforms like YouTube/Medium, NOT general information sites)`;

    console.log(`[${AGENT_NAME}] Calling LLM (timeout: ${LLM_TIMEOUT_MS / 1000}s)...`);
    const startTime = Date.now();

    const result = await withProviderFallback(
      (provider) =>
        generateObject({
          model: provider(model),
          schema: PageAnalysisSchema,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0,
          abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        }),
      AGENT_NAME
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${AGENT_NAME}] LLM call completed in ${duration}s`);

    const normalized = normalizePageAnalysis(result.object);

    generation.end({
      output: normalized,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    // Non-blocking flush - observability should never block business logic
    void safeFlush();

    return normalized as PageAnalysis;
  } catch (error) {
    generation.end({
      output: null,
      level: 'ERROR',
      statusMessage: (error as Error).message,
    });
    // Non-blocking flush - still try to log errors
    void safeFlush();
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

