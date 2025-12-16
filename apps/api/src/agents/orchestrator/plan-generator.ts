/**
 * Plan Generator
 *
 * LLM-based execution plan generation for the orchestrator agent.
 * Analyzes the URL and context to create a dynamic execution plan.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { type ExecutionPlan, type ExecutionPhase } from "../../types";
import { type AgentContext } from "../context";
import { getAgentMetadata } from "../registry";
import { withProviderFallback, LLM_TIMEOUT_MS } from "../../lib/llm-utils";

// Agent name for logging
const AGENT_NAME = "Plan Generator";

// ===================
// Schema Definition
// ===================

const ExecutionPhaseSchema = z.object({
  name: z
    .string()
    .describe('Phase name (e.g., "Discovery", "Research", "Analysis")'),
  agents: z.array(z.string()).describe("Agent IDs to run in this phase"),
  runInParallel: z
    .boolean()
    .describe("Whether agents in this phase can run in parallel"),
  dependsOn: z
    .array(z.string())
    .optional()
    .describe("Phase names this phase depends on"),
});

const ExecutionPlanSchema = z.object({
  phases: z.array(ExecutionPhaseSchema),
  estimatedDuration: z.number().describe("Estimated duration in seconds"),
  reasoning: z.string().describe("Explanation of why this plan was chosen"),
});

// ===================
// Available Agents
// ===================

// NOTE: perplexity, google-aio are disabled (require special setup)
// community-signals is now enabled - finds Reddit/Twitter engagement opportunities
const AVAILABLE_AGENTS = {
  discovery: ["page-analysis", "query-generation", "competitor-discovery"],
  research: ["tavily-research", "community-signals"], // Disabled: 'google-aio', 'perplexity'
  analysis: ["citation-analysis", "content-comparison", "visibility-scoring"],
  output: ["recommendations", "cursor-prompt", "report-generator"],
};

// Agents that are stubs or require special setup
export const DISABLED_AGENTS = new Set(["perplexity", "google-aio"]);

// ===================
// Static Fallback Plan (Optimized)
// ===================

/**
 * Optimized deterministic plan with guaranteed correct dependency ordering.
 * - Combines sequential discovery steps for efficiency
 * - Excludes disabled/stub agents
 * - 5 phases instead of 8 for faster execution
 */
const STATIC_EXECUTION_PLAN: ExecutionPlan = {
  phases: [
    // Phase 1: Discovery (sequential - dependencies require ordering)
    {
      name: "Discovery",
      agents: ["page-analysis", "query-generation", "competitor-discovery"],
      runInParallel: false,
    },
    // Phase 2: Research (can run in parallel - both depend only on query-generation)
    {
      name: "Research",
      agents: ["tavily-research", "community-signals"],
      runInParallel: true,
    },
    // Phase 3: Analysis (can run in parallel)
    {
      name: "Analysis",
      agents: ["citation-analysis", "content-comparison"],
      runInParallel: true,
    },
    // Phase 4: Scoring (depends on Analysis)
    { name: "Scoring", agents: ["visibility-scoring"], runInParallel: false },
    // Phase 5: Output (sequential)
    {
      name: "Output",
      agents: ["recommendations", "cursor-prompt"],
      runInParallel: false,
    },
  ],
  estimatedDuration: 100,
  reasoning:
    "Full pipeline with Tavily research and community engagement discovery",
};

// ===================
// Plan Sanitization
// ===================

/**
 * Remove disabled/stub agents from the execution plan
 */
function sanitizePlan(plan: ExecutionPlan): ExecutionPlan {
  const sanitizedPhases = plan.phases
    .map((phase) => ({
      ...phase,
      agents: phase.agents.filter((agent) => !DISABLED_AGENTS.has(agent)),
    }))
    .filter((phase) => phase.agents.length > 0); // Remove empty phases

  return {
    ...plan,
    phases: sanitizedPhases,
  };
}

// ===================
// Plan Validation
// ===================

/**
 * Validate that an execution plan respects all agent dependencies.
 * Returns the plan if valid, or throws an error describing violations.
 */
function validatePlan(plan: ExecutionPlan): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const willBeExecuted = new Set<string>();

  for (const phase of plan.phases) {
    // Check each agent in this phase
    for (const agentId of phase.agents) {
      const metadata = getAgentMetadata(agentId);
      if (!metadata) {
        errors.push(`Unknown agent: ${agentId}`);
        continue;
      }

      // Check that all dependencies are either already executed OR in the same phase (if sequential)
      for (const dep of metadata.inputs) {
        const depInPreviousPhase = willBeExecuted.has(dep);
        const depInSamePhase = phase.agents.includes(dep);

        if (!depInPreviousPhase && !depInSamePhase) {
          errors.push(
            `Agent ${agentId} depends on ${dep} which hasn't been scheduled yet`,
          );
        }

        // If dep is in the same phase AND running in parallel, that's a problem
        if (depInSamePhase && phase.runInParallel) {
          errors.push(
            `Agent ${agentId} depends on ${dep} but both are in parallel phase ${phase.name}`,
          );
        }
      }
    }

    // After this phase, all its agents will be executed
    phase.agents.forEach((a) => willBeExecuted.add(a));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Fix common plan issues by restructuring phases
 */
function fixPlan(plan: ExecutionPlan): ExecutionPlan {
  console.log("[Plan] Attempting to fix invalid plan...");

  // The most common issue is visibility-scoring in parallel with its dependencies
  // Split any phase that has dependency violations
  const fixedPhases: ExecutionPhase[] = [];

  for (const phase of plan.phases) {
    if (phase.runInParallel && phase.agents.length > 1) {
      // Check for internal dependencies
      const needsSplitting = phase.agents.some((agentId) => {
        const metadata = getAgentMetadata(agentId);
        return metadata?.inputs.some((dep) => phase.agents.includes(dep));
      });

      if (needsSplitting) {
        console.log(
          `[Plan] Splitting phase ${phase.name} due to internal dependencies`,
        );

        // Find agents with dependencies on other agents in this phase
        const hasInternalDeps: string[] = [];
        const noInternalDeps: string[] = [];

        for (const agentId of phase.agents) {
          const metadata = getAgentMetadata(agentId);
          const hasDep = metadata?.inputs.some((dep) =>
            phase.agents.includes(dep),
          );
          if (hasDep) {
            hasInternalDeps.push(agentId);
          } else {
            noInternalDeps.push(agentId);
          }
        }

        // Add phase for agents without internal deps (can run in parallel)
        if (noInternalDeps.length > 0) {
          fixedPhases.push({
            name: `${phase.name}-parallel`,
            agents: noInternalDeps,
            runInParallel: noInternalDeps.length > 1,
          });
        }

        // Add separate phase for agents with internal deps (must run after)
        for (const agentId of hasInternalDeps) {
          fixedPhases.push({
            name: `${phase.name}-${agentId}`,
            agents: [agentId],
            runInParallel: false,
          });
        }
      } else {
        fixedPhases.push(phase);
      }
    } else {
      fixedPhases.push(phase);
    }
  }

  return {
    ...plan,
    phases: fixedPhases,
    reasoning: `${plan.reasoning} (fixed for dependency ordering)`,
  };
}

// ===================
// Main Function
// ===================

/**
 * Generate execution plan from URL and context
 */
export async function createExecutionPlan(
  targetUrl: string,
  domain: string,
  context: AgentContext,
  tenantId: string,
  jobId: string,
  model = "gpt-4o-mini",
): Promise<ExecutionPlan> {
  try {
    // Build context summary for LLM
    const contextSummary = buildContextSummary(context);

    const systemPrompt = `You are an expert orchestrator for an AEO (Answer Engine Optimization) analysis pipeline.

Your task is to create an execution plan that determines:
1. Which agents to run
2. In what order (considering dependencies)
3. Which agents can run in parallel
4. Estimated duration

Available agents (USE ONLY THESE):
- Discovery: ${AVAILABLE_AGENTS.discovery.join(", ")}
- Research: ${AVAILABLE_AGENTS.research.join(", ")}
- Analysis: ${AVAILABLE_AGENTS.analysis.join(", ")}
- Output: ${AVAILABLE_AGENTS.output.join(", ")}

NOTE: Do NOT include these disabled agents: google-aio, perplexity

CRITICAL DEPENDENCY RULES (MUST FOLLOW):
1. page-analysis MUST be the FIRST agent to run (no dependencies)
2. query-generation depends on page-analysis (must run AFTER page-analysis)
3. competitor-discovery depends on query-generation
4. tavily-research depends on query-generation
5. citation-analysis depends on tavily-research
6. content-comparison depends on page-analysis, competitor-discovery, AND tavily-research (needs search results for content snippets)
7. visibility-scoring depends on citation-analysis AND content-comparison
8. recommendations depends on visibility-scoring
9. cursor-prompt depends on recommendations

RECOMMENDED STRUCTURE (5 phases):
Phase 1 - Discovery: page-analysis, then query-generation, then competitor-discovery (sequential)
Phase 2 - Research: tavily-research
Phase 3 - Analysis: citation-analysis, content-comparison (parallel)
Phase 4 - Scoring: visibility-scoring
Phase 5 - Output: recommendations, cursor-prompt (sequential)

IMPORTANT: Always start with page-analysis in the first phase!`;

    const userPrompt = `Create an execution plan for analyzing: ${targetUrl} (${domain})

Current context:
${contextSummary}

Generate a plan that:
1. Skips agents that are already completed
2. Runs agents in the correct dependency order
3. Parallelizes agents when possible
4. Estimates realistic duration`;

    console.log(
      `[${AGENT_NAME}] Calling LLM for execution plan (timeout: ${LLM_TIMEOUT_MS / 1000}s)...`,
    );
    const startTime = Date.now();

    const result = await withProviderFallback(
      (provider) =>
        generateObject({
          model: provider(model),
          schema: ExecutionPlanSchema,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.3, // Slight creativity for plan optimization
          abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        }),
      AGENT_NAME,
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${AGENT_NAME}] LLM call completed in ${duration}s`);

    let finalPlan = result.object as ExecutionPlan;

    // First, sanitize the plan to remove disabled agents
    finalPlan = sanitizePlan(finalPlan);

    // Validate the LLM-generated plan
    console.log(
      `[Plan] Validating LLM-generated plan with ${finalPlan.phases.length} phases`,
    );
    const validation = validatePlan(finalPlan);

    if (!validation.valid) {
      console.warn(
        `[Plan] LLM plan has dependency issues: ${validation.errors.join("; ")}`,
      );

      // Try to fix the plan
      const fixedPlan = fixPlan(finalPlan);
      const fixValidation = validatePlan(fixedPlan);

      if (fixValidation.valid) {
        console.log(`[Plan] Fixed plan is valid, using fixed version`);
        finalPlan = fixedPlan;
      } else {
        console.warn(
          `[Plan] Could not fix plan, falling back to static plan. Remaining errors: ${fixValidation.errors.join("; ")}`,
        );
        // Sanitize the static plan to remove disabled agents
        finalPlan = sanitizePlan(STATIC_EXECUTION_PLAN);
      }
    } else {
      console.log(`[Plan] LLM-generated plan is valid`);
    }

    // Log the final plan
    console.log(
      `[Plan] Final execution plan: ${JSON.stringify(finalPlan.phases.map((p) => ({ name: p.name, agents: p.agents, parallel: p.runInParallel })))}`,
    );

    return finalPlan;
  } catch (error) {
    throw error;
  }
}

/**
 * Build a summary of current context for LLM
 */
function buildContextSummary(context: AgentContext): string {
  const completed = Object.values(context.summaries)
    .filter((s) => s.status === "completed")
    .map((s) => `- ${s.agentId}: ${s.summary}`)
    .join("\n");

  const running = Object.values(context.summaries)
    .filter((s) => s.status === "running")
    .map((s) => s.agentId)
    .join(", ");

  return `Completed agents:
${completed || "None"}

Running agents: ${running || "None"}

Total agents: ${Object.keys(context.summaries).length}`;
}
