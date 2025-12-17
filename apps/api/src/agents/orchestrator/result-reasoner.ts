/**
 * Result Reasoner
 *
 * LLM-based analysis of intermediate results to adjust execution plan
 * and determine next steps.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { type AgentContext } from "../context";
import { LLM_TIMEOUT_MS } from "../../lib/llm-utils";

// Agent name for logging
const AGENT_NAME = "Result Reasoner";

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ===================
// Schema Definition
// ===================

const ReasoningResultSchema = z.object({
  shouldContinue: z.boolean().describe("Whether to continue with the plan"),
  nextSteps: z.array(z.string()).describe("Recommended next steps"),
  adjustments: z
    .array(z.string())
    .optional()
    .describe("Suggested adjustments to the plan"),
  insights: z.array(z.string()).describe("Key insights from current results"),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence in current results (0-100)"),
});

// ===================
// Main Function
// ===================

/**
 * Reason over intermediate results and suggest next steps
 */
export async function reasonOverResults(
  context: AgentContext,
  tenantId: string,
  jobId: string,
  model = "gpt-4o-mini",
): Promise<{
  shouldContinue: boolean;
  nextSteps: string[];
  adjustments?: string[];
  insights: string[];
  confidence: number;
}> {
  try {
    // Build summary of all results
    const resultsSummary = buildResultsSummary(context);

    const systemPrompt = `You are an expert analyst reviewing intermediate results from an AEO analysis pipeline.

Your task is to:
1. Analyze the current state of the analysis
2. Identify patterns and insights
3. Determine if we should continue or adjust the plan
4. Suggest next steps

Be strategic and data-driven. Look for:
- Quality of results so far
- Missing critical information
- Opportunities to optimize
- Potential issues or blockers`;

    const userPrompt = `Analyze these intermediate results:

${resultsSummary}

Provide reasoning about:
1. Should we continue with the current plan?
2. What are the key insights so far?
3. What adjustments (if any) should we make?
4. What are the recommended next steps?
5. How confident are we in the results so far?`;

    console.log(
      `[${AGENT_NAME}] Calling LLM for reasoning (timeout: ${LLM_TIMEOUT_MS / 1000}s)...`,
    );

    const result = await generateObject({
      model: openai(model),
      schema: ReasoningResultSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    const reasoningResult = result.object;

    return reasoningResult;
  } catch (error) {
    throw error;
  }
}

/**
 * Build a summary of all results for reasoning
 */
function buildResultsSummary(context: AgentContext): string {
  const summaries = Object.values(context.summaries);

  const completed = summaries
    .filter((s) => s.status === "completed")
    .map((s) => {
      return `**${s.agentId}**:
- Summary: ${s.summary}
- Key Findings: ${s.keyFindings.slice(0, 3).join(", ")}
- Metrics: ${Object.entries(s.metrics)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`;
    })
    .join("\n\n");

  const failed = summaries
    .filter((s) => s.status === "failed")
    .map((s) => `- ${s.agentId}: ${s.summary}`)
    .join("\n");

  return `Completed Agents (${summaries.filter((s) => s.status === "completed").length}):
${completed || "None"}

Failed Agents (${summaries.filter((s) => s.status === "failed").length}):
${failed || "None"}

Running Agents (${summaries.filter((s) => s.status === "running").length}):
${
  summaries
    .filter((s) => s.status === "running")
    .map((s) => s.agentId)
    .join(", ") || "None"
}`;
}
