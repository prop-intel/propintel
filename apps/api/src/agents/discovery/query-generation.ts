/**
 * Query Generation Agent
 *
 * Generates target queries that a page should be answering.
 * These are the queries users might ask AI systems that should
 * result in the analyzed page being cited.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { type PageAnalysis, type TargetQuery } from "../../types";
import { LLM_TIMEOUT_MS } from "../../lib/llm-utils";

// Agent name for logging
const AGENT_NAME = "Query Generation";

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ===================
// Configuration
// ===================

const DEFAULT_QUERY_COUNT = 10;

// ===================
// Schema Definition
// ===================

const QuerySchema = z.object({
  query: z.string().describe("The natural language query a user might ask"),
  type: z
    .string()
    .describe(
      "The type of query (how-to, what-is, comparison, best, why, other)",
    ),
  relevanceScore: z
    .number()
    .min(0)
    .max(100)
    .describe("How relevant this query is to the page content (0-100)"),
});

const QueriesSchema = z.object({
  queries: z.array(QuerySchema).optional().describe("List of target queries"),
});

// Normalize queries result
function normalizeQueries(data: z.infer<typeof QueriesSchema>) {
  return {
    queries: (data.queries ?? []).map((q) => ({
      query: q.query,
      type: (q.type?.toLowerCase() || "other") as
        | "how-to"
        | "what-is"
        | "comparison"
        | "best"
        | "why"
        | "other",
      relevanceScore: q.relevanceScore,
    })),
  };
}

// ===================
// Main Function
// ===================

/**
 * Generate target queries based on page analysis
 */
export async function generateTargetQueries(
  pageAnalysis: PageAnalysis,
  domain: string,
  tenantId: string,
  jobId: string,
  options: {
    queryCount?: number;
    model?: string;
  } = {},
): Promise<TargetQuery[]> {
  const { queryCount = DEFAULT_QUERY_COUNT, model = "gpt-4o-mini" } = options;

  try {
    const systemPrompt = `You are an expert in AI search optimization and user intent analysis.

Your task is to generate queries that users might ask AI assistants (ChatGPT, Perplexity, Google AI, etc.) 
that SHOULD result in the analyzed page being cited as a source.

Generate diverse query types:
- "How to" queries for tutorials and guides
- "What is" queries for definitions and explanations
- "Best" queries for recommendations and comparisons
- "Why" queries for reasoning and explanations
- Comparison queries (X vs Y)
- Specific problem-solving queries

Make queries natural - how real users would actually ask questions.
Focus on queries where this specific page would be a valuable, citable source.`;

    const userPrompt = `Generate ${queryCount} target queries for this page:

Domain: ${domain}
Topic: ${pageAnalysis.topic}
Content Type: ${pageAnalysis.contentType}
User Intent: ${pageAnalysis.intent}
Key Entities: ${pageAnalysis.entities.join(", ")}
Summary: ${pageAnalysis.summary}
Key Points:
${pageAnalysis.keyPoints.map((p) => `- ${p}`).join("\n")}

Generate ${queryCount} diverse queries that should lead AI systems to cite this page.
Prioritize queries with high search volume potential.
Assign relevance scores based on how well the page content answers each query.`;

    console.log(
      `[${AGENT_NAME}] Calling LLM (timeout: ${LLM_TIMEOUT_MS / 1000}s)...`,
    );
    const startTime = Date.now();

    const result = await generateObject({
      model: openai(model),
      schema: QueriesSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3, // Slight variation for query diversity
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${AGENT_NAME}] LLM call completed in ${duration}s`);

    const normalized = normalizeQueries(result.object);

    // Sort by relevance score descending
    const queries = normalized.queries as TargetQuery[];
    queries.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return queries;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate additional queries focused on specific aspects
 */
export async function generateFocusedQueries(
  pageAnalysis: PageAnalysis,
  domain: string,
  focusArea: "comparison" | "how-to" | "problems" | "benefits",
  tenantId: string,
  jobId: string,
  options: {
    queryCount?: number;
    model?: string;
  } = {},
): Promise<TargetQuery[]> {
  const { queryCount = 5, model = "gpt-4o-mini" } = options;

  try {
    const focusPrompts: Record<string, string> = {
      comparison: `Generate comparison queries (X vs Y, alternatives to, differences between) 
related to ${pageAnalysis.topic}. Users asking these want to compare options.`,

      "how-to": `Generate step-by-step "how to" queries related to ${pageAnalysis.topic}.
Users asking these want practical guidance and tutorials.`,

      problems: `Generate problem-solving queries related to ${pageAnalysis.topic}.
Users asking these are experiencing issues and need solutions.`,

      benefits: `Generate queries about benefits, advantages, and reasons to use/choose
something related to ${pageAnalysis.topic}. Users asking these are evaluating options.`,
    };

    const systemPrompt = `You are an expert in AI search optimization.
${focusPrompts[focusArea]}

Generate natural queries that real users would ask AI assistants.`;

    const userPrompt = `Generate ${queryCount} ${focusArea} queries for:

Topic: ${pageAnalysis.topic}
Entities: ${pageAnalysis.entities.join(", ")}
Key Points: ${pageAnalysis.keyPoints.join("; ")}

These queries should be answerable by the page content.`;

    const result = await generateObject({
      model: openai(model),
      schema: QueriesSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    const normalized = normalizeQueries(result.object);

    return normalized.queries as TargetQuery[];
  } catch (error) {
    throw error;
  }
}
