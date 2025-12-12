/**
 * Plan Generator
 *
 * LLM-based execution plan generation for the orchestrator agent.
 * Analyzes the URL and context to create a dynamic execution plan.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { type ExecutionPlan, type ExecutionPhase } from '../../types';
import { type AgentContext } from '../context';
import { createTrace, flushLangfuse } from '../../lib/langfuse';
import { getAgentMetadata } from '../registry';

// ===================
// Client Initialization
// ===================

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
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
// Static Fallback Plan
// ===================

/**
 * Deterministic fallback plan with guaranteed correct dependency ordering.
 * Used when LLM-generated plan fails validation.
 */
const STATIC_EXECUTION_PLAN: ExecutionPlan = {
  phases: [
    { name: 'Discovery-1', agents: ['page-analysis'], runInParallel: false },
    { name: 'Discovery-2', agents: ['query-generation'], runInParallel: false },
    { name: 'Discovery-3', agents: ['competitor-discovery'], runInParallel: false },
    { name: 'Research', agents: ['tavily-research', 'google-aio', 'perplexity', 'community-signals'], runInParallel: true },
    { name: 'Analysis-1', agents: ['citation-analysis', 'content-comparison'], runInParallel: true },
    { name: 'Analysis-2', agents: ['visibility-scoring'], runInParallel: false },
    { name: 'Output-1', agents: ['recommendations'], runInParallel: false },
    { name: 'Output-2', agents: ['cursor-prompt'], runInParallel: false },
  ],
  estimatedDuration: 180,
  reasoning: 'Static fallback plan with guaranteed dependency ordering',
};

// ===================
// Plan Validation
// ===================

/**
 * Validate that an execution plan respects all agent dependencies.
 * Returns the plan if valid, or throws an error describing violations.
 */
function validatePlan(plan: ExecutionPlan): { valid: boolean; errors: string[] } {
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
          errors.push(`Agent ${agentId} depends on ${dep} which hasn't been scheduled yet`);
        }
        
        // If dep is in the same phase AND running in parallel, that's a problem
        if (depInSamePhase && phase.runInParallel) {
          errors.push(`Agent ${agentId} depends on ${dep} but both are in parallel phase ${phase.name}`);
        }
      }
    }
    
    // After this phase, all its agents will be executed
    phase.agents.forEach(a => willBeExecuted.add(a));
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Fix common plan issues by restructuring phases
 */
function fixPlan(plan: ExecutionPlan): ExecutionPlan {
  console.log('[Plan] Attempting to fix invalid plan...');
  
  // The most common issue is visibility-scoring in parallel with its dependencies
  // Split any phase that has dependency violations
  const fixedPhases: ExecutionPhase[] = [];
  
  for (const phase of plan.phases) {
    if (phase.runInParallel && phase.agents.length > 1) {
      // Check for internal dependencies
      const needsSplitting = phase.agents.some(agentId => {
        const metadata = getAgentMetadata(agentId);
        return metadata?.inputs.some(dep => phase.agents.includes(dep));
      });
      
      if (needsSplitting) {
        console.log(`[Plan] Splitting phase ${phase.name} due to internal dependencies`);
        
        // Find agents with dependencies on other agents in this phase
        const hasInternalDeps: string[] = [];
        const noInternalDeps: string[] = [];
        
        for (const agentId of phase.agents) {
          const metadata = getAgentMetadata(agentId);
          const hasDep = metadata?.inputs.some(dep => phase.agents.includes(dep));
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
  model = 'gpt-4o-mini'
): Promise<ExecutionPlan> {
  const trace = createTrace({
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

CRITICAL DEPENDENCY RULES:
1. Discovery phase (sequential): page-analysis → query-generation → competitor-discovery
2. Research phase (parallel): tavily-research, google-aio, perplexity, community-signals can run in parallel after query-generation
3. Analysis phase has TWO sub-phases:
   - First: citation-analysis and content-comparison can run in parallel
   - Second: visibility-scoring MUST run AFTER citation-analysis and content-comparison complete
4. Output phase (sequential): recommendations → cursor-prompt → report-generator

IMPORTANT: visibility-scoring depends on citation-analysis AND content-comparison. 
Never put visibility-scoring in the same parallel phase as citation-analysis or content-comparison.

Consider what's already completed in the context.
Optimize for speed by parallelizing when possible, but ALWAYS respect dependencies.`;

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

    let finalPlan = result.object;
    
    // Validate the LLM-generated plan
    console.log(`[Plan] Validating LLM-generated plan with ${finalPlan.phases.length} phases`);
    const validation = validatePlan(finalPlan);
    
    if (!validation.valid) {
      console.warn(`[Plan] LLM plan has dependency issues: ${validation.errors.join('; ')}`);
      
      // Try to fix the plan
      const fixedPlan = fixPlan(finalPlan);
      const fixValidation = validatePlan(fixedPlan);
      
      if (fixValidation.valid) {
        console.log(`[Plan] Fixed plan is valid, using fixed version`);
        finalPlan = fixedPlan;
      } else {
        console.warn(`[Plan] Could not fix plan, falling back to static plan. Remaining errors: ${fixValidation.errors.join('; ')}`);
        finalPlan = STATIC_EXECUTION_PLAN;
      }
    } else {
      console.log(`[Plan] LLM-generated plan is valid`);
    }
    
    // Log the final plan
    console.log(`[Plan] Final execution plan: ${JSON.stringify(finalPlan.phases.map(p => ({ name: p.name, agents: p.agents, parallel: p.runInParallel })))}`);

    generation.end({
      output: finalPlan,
      usage: {
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      },
    });

    await flushLangfuse();

    return finalPlan;
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
