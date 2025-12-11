/**
 * Plan Generator
 *
 * LLM-based execution plan generation for the orchestrator agent.
 * Analyzes the URL and context to create a dynamic execution plan.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Langfuse } from 'langfuse';
import { ExecutionPlan, ExecutionPhase } from '../../types';
import { AgentContext } from '../context';

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

const ExecutionPhaseSchema = z.object({
  name: z.string().describe('Phase name (e.g., "Discovery", "Research", "Analysis")'),
  agents: z.array(z.string()).describe('Agent IDs to run in this phase'),
  runInParallel: z.boolean().describe('Whether agents in this phase can run in parallel'),
  dependsOn: z.array(z.string()).optional().describe('Phase names this phase depends on'),
});

const ExecutionPlanSchema = z.object({
  phases: z.array(ExecutionPhaseSchema),
  estimatedDuration: z.number().describe('Estimated duration in seconds'),
  reasoning: z.string().describe('Explanation of why this plan was chosen'),
});

// ===================
// Available Agents
// ===================

const AVAILABLE_AGENTS = {
  discovery: ['page-analysis', 'query-generation', 'competitor-discovery'],
  research: ['tavily-research', 'google-aio', 'perplexity', 'community-signals'],
  analysis: ['citation-analysis', 'content-comparison', 'visibility-scoring'],
  output: ['recommendations', 'cursor-prompt', 'report-generator'],
};

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
  model: string = 'gpt-4o-mini'
): Promise<ExecutionPlan> {
  const trace = langfuse.trace({
    name: 'execution-plan-generation',
    userId: tenantId,
    metadata: { jobId, domain, url: targetUrl },
  });

  const generation = trace.generation({
    name: 'plan-generation',
    model,
    input: { url: targetUrl, domain },
  });

  try {
    // Build context summary for LLM
    const contextSummary = buildContextSummary(context);

    const systemPrompt = `You are an expert orchestrator for an AEO (Answer Engine Optimization) analysis pipeline.

Your task is to create an execution plan that determines:
1. Which agents to run
2. In what order (considering dependencies)
3. Which agents can run in parallel
4. Estimated duration

Available agents:
- Discovery: ${AVAILABLE_AGENTS.discovery.join(', ')}
- Research: ${AVAILABLE_AGENTS.research.join(', ')}
- Analysis: ${AVAILABLE_AGENTS.analysis.join(', ')}
- Output: ${AVAILABLE_AGENTS.output.join(', ')}

Rules:
- Discovery agents must run first (sequential: page-analysis → query-generation → competitor-discovery)
- Research agents can run in parallel after queries are generated
- Analysis agents can run in parallel after research completes
- Output agents run last (sequential: recommendations → cursor-prompt → report-generator)
- Consider what's already completed in the context
- Optimize for speed by parallelizing when possible`;

    const userPrompt = `Create an execution plan for analyzing: ${targetUrl} (${domain})

Current context:
${contextSummary}

Generate a plan that:
1. Skips agents that are already completed
2. Runs agents in the correct dependency order
3. Parallelizes agents when possible
4. Estimates realistic duration`;

    const result = await generateObject({
      model: openai(model),
      schema: ExecutionPlanSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3, // Slight creativity for plan optimization
    });

    generation.end({
      output: result.object,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    await langfuse.flushAsync();

    return result.object;
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
 * Build a summary of current context for LLM
 */
function buildContextSummary(context: AgentContext): string {
  const completed = Object.values(context.summaries)
    .filter(s => s.status === 'completed')
    .map(s => `- ${s.agentId}: ${s.summary}`)
    .join('\n');

  const running = Object.values(context.summaries)
    .filter(s => s.status === 'running')
    .map(s => s.agentId)
    .join(', ');

  return `Completed agents:
${completed || 'None'}

Running agents: ${running || 'None'}

Total agents: ${Object.keys(context.summaries).length}`;
}
