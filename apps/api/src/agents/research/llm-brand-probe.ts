/**
 * LLM Brand Probe Agent
 *
 * Directly queries LLMs to measure brand visibility in AI-generated responses.
 * This is a core GEO (Generative Engine Optimization) signal - testing what
 * LLMs "know" about a brand from their training data.
 *
 * Two-stage approach:
 * 1. Generate contextually relevant prompts based on brand analysis
 * 2. Probe LLMs with those prompts and analyze for brand mentions
 */

import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createTrace, safeFlush } from "../../lib/langfuse";
import { openai } from "../../lib/openai";
import { type PageAnalysis, type TargetQuery } from "../../types";

// ===================
// Timeout Configuration
// ===================

// 60 second timeout for LLM API calls to prevent indefinite hangs
const LLM_TIMEOUT_MS = 60_000;

// ===================
// Configuration
// ===================

const DEFAULT_PROMPT_COUNT = 50;
const DEFAULT_MODELS = ["gpt-4o-mini"] as const;
const PROBE_CONCURRENCY = 5;

// ===================
// Types
// ===================

export interface LLMBrandProbeInput {
  brand: {
    name: string;
    domain: string;
    tagline?: string;
  };
  pageAnalysis: PageAnalysis;
  targetQueries: TargetQuery[];
  competitors: string[];
}

export interface ProbePrompt {
  prompt: string;
  category: PromptCategory;
  targetBrand: string;
  relatedCompetitors: string[];
}

export type PromptCategory =
  | "direct" // Questions directly about the brand
  | "category" // "Best X tools" type questions
  | "problem" // Questions about problems the brand solves
  | "use_case" // "How do I accomplish X?" questions
  | "comparison" // Brand vs competitor comparisons
  | "industry" // Industry trends and leaders
  | "recommendation"; // "What should I use for X?" questions

export interface LLMProbeResult {
  model: string;
  prompt: string;
  promptCategory: PromptCategory;
  response: string;

  // Brand mention analysis
  brandMentioned: boolean;
  mentionType: "primary" | "listed" | "compared" | "indirect" | "absent";
  mentionPosition?: number; // Position in list if applicable
  mentionContext?: string; // Excerpt where brand appears
  sentiment: "positive" | "neutral" | "negative" | "not_mentioned";

  // Competitor analysis
  competitorsMentioned: {
    name: string;
    mentioned: boolean;
    mentionType?: "primary" | "listed" | "compared" | "indirect";
    position?: number;
  }[];

  // Metadata
  probedAt: string;
  responseTokens?: number;
}

export interface LLMBrandProbeAggregate {
  // Core metrics
  overallMentionRate: number; // % of prompts where brand appeared
  primaryMentionRate: number; // % where brand was #1 or primary answer
  averageMentionPosition: number; // Average position when mentioned in lists

  // Breakdown by model
  modelBreakdown: Record<
    string,
    {
      mentionRate: number;
      primaryRate: number;
      probeCount: number;
    }
  >;

  // Breakdown by prompt category
  categoryBreakdown: Record<
    PromptCategory,
    {
      mentionRate: number;
      primaryRate: number;
      probeCount: number;
    }
  >;

  // Competitor comparison
  competitorComparison: {
    competitor: string;
    theirMentionRate: number;
    yourMentionRate: number;
    headToHeadWins: number; // # of prompts where you beat them
    headToHeadLosses: number;
  }[];

  // Sentiment analysis
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };

  // GEO Score (0-100)
  geoScore: number;
  geoGrade: string;

  // Key insights
  strongCategories: string[];
  weakCategories: string[];
  keyFindings: string[];

  // Raw data
  probeResults: LLMProbeResult[];
  generatedPrompts: ProbePrompt[];

  // Metadata
  totalProbes: number;
  modelsUsed: string[];
  probedAt: string;
}

// ===================
// Schema Definitions
// ===================

const GeneratedPromptsSchema = z.object({
  prompts: z.array(
    z.object({
      prompt: z.string().describe("The natural language prompt/question"),
      category: z
        .enum([
          "direct",
          "category",
          "problem",
          "use_case",
          "comparison",
          "industry",
          "recommendation",
        ])
        .describe("The type of prompt"),
      relatedCompetitors: z
        .array(z.string())
        .describe("Competitors this prompt might surface"),
    }),
  ),
});

const MentionAnalysisSchema = z.object({
  brandMentioned: z.boolean(),
  mentionType: z.enum(["primary", "listed", "compared", "indirect", "absent"]),
  mentionPosition: z.number().nullable().optional(),
  mentionContext: z.string().nullable().optional(),
  sentiment: z.enum(["positive", "neutral", "negative", "not_mentioned"]),
  competitorsMentioned: z.array(
    z.object({
      name: z.string(),
      mentioned: z.boolean(),
      mentionType: z
        .enum(["primary", "listed", "compared", "indirect"])
        .optional(),
      position: z.number().optional(),
    }),
  ),
});

// ===================
// Main Functions
// ===================

/**
 * Run the complete LLM Brand Probe - generate prompts and probe models
 */
export async function probeLLMsForBrand(
  input: LLMBrandProbeInput,
  tenantId: string,
  jobId: string,
  options: {
    promptCount?: number;
    models?: string[];
  } = {},
): Promise<LLMBrandProbeAggregate> {
  const { promptCount = DEFAULT_PROMPT_COUNT, models = [...DEFAULT_MODELS] } =
    options;

  const trace = createTrace({
    name: "llm-brand-probe",
    userId: tenantId,
    metadata: { jobId, brand: input.brand.name, promptCount, models },
  });

  const span = trace.span({
    name: "probe-llms-for-brand",
    input: { brand: input.brand.name, promptCount },
  }) as {
    end: (data?: {
      output?: unknown;
      level?: string;
      statusMessage?: string;
    }) => void;
  };

  try {
    // Stage 1: Generate contextually relevant prompts
    const prompts = await generateProbePrompts(
      input,
      promptCount,
      tenantId,
      jobId,
    );

    // Stage 2: Probe each model with all prompts
    const allResults: LLMProbeResult[] = [];

    for (const model of models) {
      const modelResults = await probeModel(
        model,
        prompts,
        input.brand,
        input.competitors,
        tenantId,
        jobId,
      );
      allResults.push(...modelResults);
    }

    // Stage 3: Aggregate and analyze results
    const aggregate = aggregateProbeResults(
      allResults,
      prompts,
      input.brand.name,
      input.competitors,
      models,
    );

    span.end({
      output: {
        geoScore: aggregate.geoScore,
        overallMentionRate: aggregate.overallMentionRate,
        totalProbes: aggregate.totalProbes,
      },
    });

    void safeFlush();

    return aggregate;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    span.end({
      level: "ERROR",
      statusMessage: errorMessage,
    });
    void safeFlush();
    throw error;
  }
}

// ===================
// Prompt Generation
// ===================

/**
 * Generate contextually relevant prompts based on brand analysis
 */
async function generateProbePrompts(
  input: LLMBrandProbeInput,
  promptCount: number,
  tenantId: string,
  jobId: string,
): Promise<ProbePrompt[]> {
  const trace = createTrace({
    name: "geo-prompt-generation",
    userId: tenantId,
    metadata: { jobId, brand: input.brand.name },
  });

  const generation = trace.generation({
    name: "generate-probe-prompts",
    model: "gpt-4o-mini",
  });

  try {
    const systemPrompt = `You are an expert at understanding how people ask AI assistants questions.

Given information about a brand, generate ${promptCount} diverse prompts that real users might ask an LLM where this brand COULD (or should) come up as an answer.

Categories to cover (aim for this distribution):
- DIRECT (10%): Questions directly about the brand ("What is X?", "Tell me about X")
- CATEGORY (20%): "Best X tools", "Top Y platforms" in their space
- PROBLEM (25%): Questions about problems the brand solves
- USE_CASE (20%): "How do I accomplish X?" where brand is a solution
- COMPARISON (10%): Brand vs competitors, alternatives to X
- INDUSTRY (8%): Industry trends, leaders, innovations
- RECOMMENDATION (7%): "What should I use for X?" type questions

Rules:
- Make prompts sound natural, like real user questions to ChatGPT
- Vary the phrasing (questions, commands, conversational)
- Include both generic and specific versions
- Consider different user personas (beginner, expert, decision-maker)
- Don't make prompts obviously biased toward the brand
- Include prompts where competitors might reasonably be mentioned
- Use actual industry terminology and pain points`;

    const userPrompt = `Generate ${promptCount} probe prompts for:

Brand: ${input.brand.name}
Domain: ${input.brand.domain}
${input.brand.tagline ? `Tagline: ${input.brand.tagline}` : ""}

Business Category: ${input.pageAnalysis.businessCategory}
Business Model: ${input.pageAnalysis.businessModel}
Topic: ${input.pageAnalysis.topic}
Summary: ${input.pageAnalysis.summary}

Key Entities: ${input.pageAnalysis.entities.join(", ")}
Key Points: ${input.pageAnalysis.keyPoints.join("; ")}

Known Competitors: ${input.competitors.slice(0, 10).join(", ") || "None identified"}

Sample target queries (for context):
${input.targetQueries
  .slice(0, 8)
  .map((q) => `- ${q.query} (${q.type})`)
  .join("\n")}

Generate ${promptCount} natural prompts that real users might ask an AI assistant.
Focus on prompts where this brand SHOULD appear if it's well-known in its space.`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: GeneratedPromptsSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7, // Some creativity for diverse prompts
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    const prompts: ProbePrompt[] = result.object.prompts.map((p) => ({
      prompt: p.prompt,
      category: p.category as PromptCategory,
      targetBrand: input.brand.name,
      relatedCompetitors: p.relatedCompetitors,
    }));

    generation.end({
      output: { promptCount: prompts.length },
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    void safeFlush();

    return prompts;
  } catch (error) {
    generation.end({
      level: "ERROR",
      statusMessage: (error as Error).message,
    });
    void safeFlush();
    throw error;
  }
}

// ===================
// Model Probing
// ===================

/**
 * Probe a specific model with all prompts
 */
async function probeModel(
  model: string,
  prompts: ProbePrompt[],
  brand: LLMBrandProbeInput["brand"],
  competitors: string[],
  tenantId: string,
  jobId: string,
): Promise<LLMProbeResult[]> {
  const results: LLMProbeResult[] = [];

  // Process prompts in batches for concurrency
  for (let i = 0; i < prompts.length; i += PROBE_CONCURRENCY) {
    const batch = prompts.slice(i, i + PROBE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((prompt) =>
        probeSinglePrompt(model, prompt, brand, competitors, tenantId, jobId),
      ),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Probe a single prompt and analyze the response
 */
async function probeSinglePrompt(
  model: string,
  probePrompt: ProbePrompt,
  brand: LLMBrandProbeInput["brand"],
  competitors: string[],
  _tenantId: string,
  _jobId: string,
): Promise<LLMProbeResult> {
  try {
    // Step 1: Get response from LLM
    const response = await generateText({
      model: openai(model),
      prompt: probePrompt.prompt,
      maxTokens: 500,
      temperature: 0.3, // Lower temperature for more consistent responses
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    const responseText = response.text;

    // Step 2: Analyze response for brand mentions
    const analysis = await analyzeResponseForBrand(
      responseText,
      brand,
      competitors,
      probePrompt.prompt,
    );

    return {
      model,
      prompt: probePrompt.prompt,
      promptCategory: probePrompt.category,
      response: responseText,
      ...analysis,
      probedAt: new Date().toISOString(),
      responseTokens: response.usage?.completionTokens,
    };
  } catch (error) {
    // Return a failed probe result
    return {
      model,
      prompt: probePrompt.prompt,
      promptCategory: probePrompt.category,
      response: `Error: ${(error as Error).message}`,
      brandMentioned: false,
      mentionType: "absent",
      sentiment: "not_mentioned",
      competitorsMentioned: competitors.map((c) => ({
        name: c,
        mentioned: false,
      })),
      probedAt: new Date().toISOString(),
    };
  }
}

/**
 * Analyze an LLM response for brand mentions
 */
async function analyzeResponseForBrand(
  response: string,
  brand: LLMBrandProbeInput["brand"],
  competitors: string[],
  originalPrompt: string,
): Promise<
  Omit<
    LLMProbeResult,
    | "model"
    | "prompt"
    | "promptCategory"
    | "response"
    | "probedAt"
    | "responseTokens"
  >
> {
  // First, do a quick regex check for obvious mentions
  const brandRegex = new RegExp(escapeRegex(brand.name), "gi");
  const domainRegex = new RegExp(
    escapeRegex(brand.domain.replace(/^www\./, "")),
    "gi",
  );

  const hasBrandMention =
    brandRegex.test(response) || domainRegex.test(response);

  // If no obvious mention, use LLM for deeper analysis
  // (handles cases like abbreviations, product names, etc.)
  try {
    const analysisPrompt = `Analyze this AI response for mentions of a specific brand.

Brand to find: "${brand.name}" (domain: ${brand.domain})
Competitors to track: ${competitors.slice(0, 10).join(", ") || "None"}

Original question: "${originalPrompt}"

Response to analyze:
"""
${response}
"""

Determine:
1. Is the brand "${brand.name}" mentioned (directly or indirectly)?
2. If mentioned, what type? (primary recommendation, listed among options, compared to others, indirectly referenced, or absent)
3. If in a list, what position?
4. What's the sentiment toward the brand?
5. Which competitors are mentioned?`;

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: MentionAnalysisSchema,
      prompt: analysisPrompt,
      temperature: 0,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    return {
      brandMentioned: result.object.brandMentioned,
      mentionType: result.object.mentionType,
      mentionPosition: result.object.mentionPosition ?? undefined,
      mentionContext: result.object.mentionContext ?? undefined,
      sentiment: result.object.sentiment,
      competitorsMentioned: result.object.competitorsMentioned.map((c) => ({
        name: c.name,
        mentioned: c.mentioned,
        mentionType: c.mentionType,
        position: c.position,
      })),
    };
  } catch {
    // Fallback to simple regex-based analysis
    return {
      brandMentioned: hasBrandMention,
      mentionType: hasBrandMention ? "listed" : "absent",
      sentiment: hasBrandMention ? "neutral" : "not_mentioned",
      competitorsMentioned: competitors.map((c) => ({
        name: c,
        mentioned: new RegExp(escapeRegex(c), "gi").test(response),
      })),
    };
  }
}

// ===================
// Result Aggregation
// ===================

/**
 * Aggregate all probe results into summary metrics
 */
function aggregateProbeResults(
  results: LLMProbeResult[],
  prompts: ProbePrompt[],
  brandName: string,
  competitors: string[],
  models: string[],
): LLMBrandProbeAggregate {
  const totalProbes = results.length;

  // Overall metrics
  const mentionedProbes = results.filter((r) => r.brandMentioned);
  const primaryProbes = results.filter((r) => r.mentionType === "primary");

  const overallMentionRate =
    totalProbes > 0 ? (mentionedProbes.length / totalProbes) * 100 : 0;

  const primaryMentionRate =
    totalProbes > 0 ? (primaryProbes.length / totalProbes) * 100 : 0;

  // Average position when mentioned
  const positionedResults = results.filter(
    (r) => r.mentionPosition !== undefined,
  );
  const averageMentionPosition =
    positionedResults.length > 0
      ? positionedResults.reduce(
          (sum, r) => sum + (r.mentionPosition || 0),
          0,
        ) / positionedResults.length
      : 0;

  // Model breakdown
  const modelBreakdown: LLMBrandProbeAggregate["modelBreakdown"] = {};
  for (const model of models) {
    const modelResults = results.filter((r) => r.model === model);
    const modelMentioned = modelResults.filter((r) => r.brandMentioned);
    const modelPrimary = modelResults.filter(
      (r) => r.mentionType === "primary",
    );

    modelBreakdown[model] = {
      mentionRate:
        modelResults.length > 0
          ? (modelMentioned.length / modelResults.length) * 100
          : 0,
      primaryRate:
        modelResults.length > 0
          ? (modelPrimary.length / modelResults.length) * 100
          : 0,
      probeCount: modelResults.length,
    };
  }

  // Category breakdown
  const categories: PromptCategory[] = [
    "direct",
    "category",
    "problem",
    "use_case",
    "comparison",
    "industry",
    "recommendation",
  ];
  const categoryBreakdown: LLMBrandProbeAggregate["categoryBreakdown"] =
    {} as LLMBrandProbeAggregate["categoryBreakdown"];

  for (const category of categories) {
    const catResults = results.filter((r) => r.promptCategory === category);
    const catMentioned = catResults.filter((r) => r.brandMentioned);
    const catPrimary = catResults.filter((r) => r.mentionType === "primary");

    categoryBreakdown[category] = {
      mentionRate:
        catResults.length > 0
          ? (catMentioned.length / catResults.length) * 100
          : 0,
      primaryRate:
        catResults.length > 0
          ? (catPrimary.length / catResults.length) * 100
          : 0,
      probeCount: catResults.length,
    };
  }

  // Competitor comparison
  const competitorComparison: LLMBrandProbeAggregate["competitorComparison"] =
    competitors.map((competitor) => {
      let theirMentions = 0;
      let headToHeadWins = 0;
      let headToHeadLosses = 0;

      for (const result of results) {
        const competitorMention = result.competitorsMentioned.find(
          (c) => c.name.toLowerCase() === competitor.toLowerCase(),
        );

        if (competitorMention?.mentioned) theirMentions++;

        // Head to head: both mentioned, compare positions
        if (result.brandMentioned && competitorMention?.mentioned) {
          const yourPos = result.mentionPosition || 999;
          const theirPos = competitorMention.position || 999;

          if (yourPos < theirPos) headToHeadWins++;
          else if (theirPos < yourPos) headToHeadLosses++;
        }
        // You mentioned, they're not
        else if (result.brandMentioned && !competitorMention?.mentioned) {
          headToHeadWins++;
        }
        // They mentioned, you're not
        else if (!result.brandMentioned && competitorMention?.mentioned) {
          headToHeadLosses++;
        }
      }

      return {
        competitor,
        theirMentionRate:
          totalProbes > 0 ? (theirMentions / totalProbes) * 100 : 0,
        yourMentionRate: overallMentionRate,
        headToHeadWins,
        headToHeadLosses,
      };
    });

  // Sentiment breakdown
  const sentimentBreakdown = {
    positive:
      results.filter((r) => r.sentiment === "positive").length /
      Math.max(totalProbes, 1),
    neutral:
      results.filter((r) => r.sentiment === "neutral").length /
      Math.max(totalProbes, 1),
    negative:
      results.filter((r) => r.sentiment === "negative").length /
      Math.max(totalProbes, 1),
  };

  // Calculate GEO Score
  const geoScore = calculateGEOScore(
    overallMentionRate,
    primaryMentionRate,
    averageMentionPosition,
    categoryBreakdown,
    competitorComparison,
    sentimentBreakdown,
  );

  // Identify strong and weak categories
  const sortedCategories = Object.entries(categoryBreakdown).sort(
    (a, b) => b[1].mentionRate - a[1].mentionRate,
  );

  const strongCategories = sortedCategories
    .filter(([_, data]) => data.mentionRate >= 50)
    .map(([cat]) => formatCategoryName(cat as PromptCategory));

  const weakCategories = sortedCategories
    .filter(([_, data]) => data.mentionRate < 30 && data.probeCount > 0)
    .map(([cat]) => formatCategoryName(cat as PromptCategory));

  // Generate key findings
  const keyFindings = generateKeyFindings(
    overallMentionRate,
    primaryMentionRate,
    categoryBreakdown,
    competitorComparison,
    sentimentBreakdown,
  );

  return {
    overallMentionRate: Math.round(overallMentionRate * 10) / 10,
    primaryMentionRate: Math.round(primaryMentionRate * 10) / 10,
    averageMentionPosition: Math.round(averageMentionPosition * 10) / 10,
    modelBreakdown,
    categoryBreakdown,
    competitorComparison,
    sentimentBreakdown,
    geoScore,
    geoGrade: getGeoGrade(geoScore),
    strongCategories,
    weakCategories,
    keyFindings,
    probeResults: results,
    generatedPrompts: prompts,
    totalProbes,
    modelsUsed: models,
    probedAt: new Date().toISOString(),
  };
}

// ===================
// GEO Score Calculation
// ===================

/**
 * Calculate the GEO (Generative Engine Optimization) Score
 */
function calculateGEOScore(
  overallMentionRate: number,
  primaryMentionRate: number,
  avgPosition: number,
  categoryBreakdown: LLMBrandProbeAggregate["categoryBreakdown"],
  competitorComparison: LLMBrandProbeAggregate["competitorComparison"],
  sentimentBreakdown: { positive: number; neutral: number; negative: number },
): number {
  // Weight components
  const weights = {
    mentionRate: 0.3, // How often you appear
    primaryRate: 0.25, // How often you're the top answer
    position: 0.15, // Position quality when listed
    categoryBreadth: 0.1, // Coverage across categories
    competitiveWins: 0.1, // How you compare to competitors
    sentiment: 0.1, // Positive vs negative mentions
  };

  // Mention rate score (0-100)
  const mentionScore = Math.min(100, overallMentionRate);

  // Primary rate score (0-100)
  const primaryScore = Math.min(100, primaryMentionRate * 2); // Bonus for being primary

  // Position score (position 1 = 100, position 5 = 50, position 10 = 0)
  const positionScore =
    avgPosition > 0
      ? Math.max(0, 100 - (avgPosition - 1) * 12.5)
      : mentionScore > 0
        ? 50
        : 0; // Default to 50 if mentioned but no position data

  // Category breadth score
  const categoriesWithMentions = Object.values(categoryBreakdown).filter(
    (c) => c.mentionRate > 0,
  ).length;
  const categoryScore = (categoriesWithMentions / 7) * 100;

  // Competitive wins score
  const totalWins = competitorComparison.reduce(
    (sum, c) => sum + c.headToHeadWins,
    0,
  );
  const totalLosses = competitorComparison.reduce(
    (sum, c) => sum + c.headToHeadLosses,
    0,
  );
  const competitiveScore =
    totalWins + totalLosses > 0
      ? (totalWins / (totalWins + totalLosses)) * 100
      : 50; // Neutral if no competitors

  // Sentiment score
  const sentimentScore =
    sentimentBreakdown.positive * 100 +
    sentimentBreakdown.neutral * 50 -
    sentimentBreakdown.negative * 50;
  const normalizedSentiment = Math.max(0, Math.min(100, sentimentScore + 50));

  // Calculate weighted total
  const totalScore =
    mentionScore * weights.mentionRate +
    primaryScore * weights.primaryRate +
    positionScore * weights.position +
    categoryScore * weights.categoryBreadth +
    competitiveScore * weights.competitiveWins +
    normalizedSentiment * weights.sentiment;

  return Math.round(Math.max(0, Math.min(100, totalScore)));
}

/**
 * Get letter grade for GEO score
 */
function getGeoGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 40) return "D";
  return "F";
}

// ===================
// Helper Functions
// ===================

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatCategoryName(category: PromptCategory): string {
  const names: Record<PromptCategory, string> = {
    direct: "Direct brand queries",
    category: "Category/best-of lists",
    problem: "Problem-solving queries",
    use_case: "Use case questions",
    comparison: "Competitor comparisons",
    industry: "Industry discussions",
    recommendation: "Recommendation requests",
  };
  return names[category];
}

function generateKeyFindings(
  overallRate: number,
  primaryRate: number,
  categoryBreakdown: LLMBrandProbeAggregate["categoryBreakdown"],
  competitorComparison: LLMBrandProbeAggregate["competitorComparison"],
  sentiment: { positive: number; neutral: number; negative: number },
): string[] {
  const findings: string[] = [];

  // Overall visibility assessment
  if (overallRate >= 70) {
    findings.push(
      `Strong LLM visibility: Brand appears in ${Math.round(overallRate)}% of relevant prompts`,
    );
  } else if (overallRate >= 40) {
    findings.push(
      `Moderate LLM visibility: Brand appears in ${Math.round(overallRate)}% of relevant prompts`,
    );
  } else if (overallRate > 0) {
    findings.push(
      `Low LLM visibility: Brand only appears in ${Math.round(overallRate)}% of relevant prompts`,
    );
  } else {
    findings.push(
      "Critical: Brand not recognized by LLMs in any tested prompts",
    );
  }

  // Primary recommendation rate
  if (primaryRate >= 30) {
    findings.push(
      `Excellent brand authority: Primary recommendation in ${Math.round(primaryRate)}% of responses`,
    );
  } else if (primaryRate < 10 && overallRate > 30) {
    findings.push(
      `Listed but rarely primary: Consider content that positions brand as the top solution`,
    );
  }

  // Category insights
  const bestCategory = Object.entries(categoryBreakdown).sort(
    (a, b) => b[1].mentionRate - a[1].mentionRate,
  )[0];
  const worstCategory = Object.entries(categoryBreakdown)
    .filter(([_, d]) => d.probeCount > 0)
    .sort((a, b) => a[1].mentionRate - b[1].mentionRate)[0];

  if (bestCategory && bestCategory[1].mentionRate > 50) {
    findings.push(
      `Strongest in ${formatCategoryName(bestCategory[0] as PromptCategory)} (${Math.round(bestCategory[1].mentionRate)}% mention rate)`,
    );
  }

  if (
    worstCategory &&
    worstCategory[1].mentionRate < 20 &&
    worstCategory[1].probeCount >= 3
  ) {
    findings.push(
      `Gap in ${formatCategoryName(worstCategory[0] as PromptCategory)} - only ${Math.round(worstCategory[1].mentionRate)}% mention rate`,
    );
  }

  // Competitor insights
  const beatingYou = competitorComparison.filter(
    (c) => c.theirMentionRate > overallRate + 10,
  );
  if (beatingYou.length > 0) {
    const topCompetitor = beatingYou.sort(
      (a, b) => b.theirMentionRate - a.theirMentionRate,
    )[0];
    if (topCompetitor) {
      findings.push(
        `${topCompetitor.competitor} has higher LLM visibility (${Math.round(topCompetitor.theirMentionRate)}% vs your ${Math.round(overallRate)}%)`,
      );
    }
  }

  // Sentiment
  if (sentiment.negative > 0.1) {
    findings.push(
      `Warning: ${Math.round(sentiment.negative * 100)}% of mentions have negative sentiment`,
    );
  } else if (sentiment.positive > 0.5) {
    findings.push(
      `Positive brand perception: ${Math.round(sentiment.positive * 100)}% of mentions are positive`,
    );
  }

  return findings;
}
