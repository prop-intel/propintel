/**
 * Summary Generator
 *
 * LLM-based summarization of agent results to keep context lightweight.
 * Generates structured summaries that can be used by the orchestrator
 * for planning and reasoning without loading full data.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Langfuse } from 'langfuse';

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

const AgentSummarySchema = z.object({
  summary: z.string().describe('A concise 2-3 sentence summary of the agent result'),
  keyFindings: z.array(z.string()).optional().describe('Top 3-5 key findings or insights'),
  metrics: z.record(z.number()).optional().describe('Key numeric metrics extracted from the result'),
  status: z.enum(['completed', 'partial', 'failed']).optional().describe('Overall status of the agent execution'),
  nextSteps: z.array(z.string()).optional().describe('Suggested next steps based on this result'),
});

// Post-process to ensure required fields have defaults
function normalizeAgentSummary(data: z.infer<typeof AgentSummarySchema>): {
  summary: string;
  keyFindings: string[];
  metrics: Record<string, number>;
  status: 'completed' | 'partial' | 'failed';
  nextSteps?: string[];
} {
  return {
    summary: data.summary,
    keyFindings: data.keyFindings ?? [],
    metrics: data.metrics ?? {},
    status: data.status ?? 'completed',
    nextSteps: data.nextSteps,
  };
}

// ===================
// Main Function
// ===================

/**
 * Generate a structured summary from an agent result
 */
export async function generateAgentSummary(
  agentId: string,
  agentResult: unknown,
  tenantId: string,
  jobId: string,
  model: string = 'gpt-4o-mini'
): Promise<{
  summary: string;
  keyFindings: string[];
  metrics: Record<string, number>;
  status: 'completed' | 'partial' | 'failed';
  nextSteps?: string[];
}> {
  const trace = langfuse.trace({
    name: 'agent-summary-generation',
    userId: tenantId,
    metadata: { jobId, agentId },
  });

  const generation = trace.generation({
    name: 'summary-generation',
    model,
    input: { agentId },
  });

  try {
    // Serialize result to JSON string for LLM
    const resultJson = JSON.stringify(agentResult, null, 2);
    const resultPreview = resultJson.slice(0, 4000); // Limit to first 4KB

    const systemPrompt = `You are an expert at summarizing technical analysis results. 
Extract the most important information from agent results and create a concise summary.

Focus on:
- Key findings and insights
- Important metrics and numbers
- Overall status/success
- What this means for next steps

Be concise but informative.`;

    const userPrompt = `Summarize this agent result for agent "${agentId}":

${resultPreview}

${resultJson.length > 4000 ? `\n[Result truncated - showing first 4000 chars of ${resultJson.length} total]` : ''}

Generate a structured summary with key findings, metrics, and status.`;

    const result = await generateObject({
      model: openai(model),
      schema: AgentSummarySchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
    });

    const normalized = normalizeAgentSummary(result.object);

    generation.end({
      output: normalized,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    await langfuse.flushAsync();

    return normalized;
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
 * Generate a brief summary (for compression scenarios)
 */
export async function generateBriefSummary(
  agentId: string,
  agentResult: unknown,
  tenantId: string,
  jobId: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const trace = langfuse.trace({
    name: 'brief-summary-generation',
    userId: tenantId,
    metadata: { jobId, agentId },
  });

  const generation = trace.generation({
    name: 'brief-summary',
    model,
  });

  try {
    const resultJson = JSON.stringify(agentResult, null, 2);
    const resultPreview = resultJson.slice(0, 2000);

    const systemPrompt = `Generate a very brief one-sentence summary of this agent result.`;

    const userPrompt = `Agent: ${agentId}\nResult preview:\n${resultPreview}`;

    const result = await generateObject({
      model: openai(model),
      schema: z.object({
        summary: z.string().describe('One sentence summary'),
      }),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
    });

    generation.end({
      output: result.object,
    });

    await langfuse.flushAsync();

    return result.object.summary;
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
