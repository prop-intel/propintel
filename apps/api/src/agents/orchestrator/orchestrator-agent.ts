/**
 * Orchestrator Agent
 *
 * Light deep agent that coordinates the AEO analysis pipeline.
 * Uses LLM for planning and reasoning, manages context, and executes agents.
 */

import { ContextManager, type AgentContext } from '../context';
import { createExecutionPlan } from './plan-generator';
import { reasonOverResults } from './result-reasoner';
import { type ExecutionPlan } from '../../types';
import { getAgentRegistry } from '../registry';
import { executeAgents } from '../executor';

// ===================
// Orchestrator Agent Class
// ===================

export class OrchestratorAgent {
  private context: ContextManager;
  private plan: ExecutionPlan | null = null;

  constructor(jobId: string, tenantId: string, domain: string) {
    this.context = new ContextManager(jobId, tenantId, domain);
  }

  /**
   * Initialize orchestrator and create execution plan
   */
  async initialize(
    targetUrl: string,
    domain: string,
    model = 'gpt-4o-mini'
  ): Promise<ExecutionPlan> {
    const context = this.context.getContext();
    this.plan = await createExecutionPlan(
      targetUrl,
      domain,
      context,
      context.tenantId,
      context.jobId,
      model
    );

    return this.plan;
  }

  /**
   * Get all agent summaries for progress updates
   */
  getAllAgentSummaries(): Record<string, { status: string; summary?: string; keyFindings?: string[] }> {
    return this.context.getAllSummaries();
  }

  /**
   * Execute the plan
   * @param model LLM model to use
   * @param onPhaseComplete Callback called after each phase with current agent summaries
   */
  async execute(
    model = 'gpt-4o-mini',
    onPhaseComplete?: (phaseName: string, agentSummaries: Record<string, unknown>) => Promise<void>
  ): Promise<void> {
    if (!this.plan) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const context = this.context.getContext();
    const registry = getAgentRegistry();

    // Execute each phase
    const totalPhases = this.plan.phases.length;
    for (let i = 0; i < totalPhases; i++) {
      const phase = this.plan.phases[i];
      if (!phase) continue;
      
      console.log(`[Orchestrator] Executing phase ${i + 1}/${totalPhases}: ${phase.name}`);
      console.log(`[Orchestrator] Phase agents: ${phase.agents.join(', ')}, parallel: ${phase.runInParallel}`);

      // Mark agents as running
      for (const agentId of phase.agents) {
        this.context.markAgentRunning(agentId);
      }

      try {
        // Execute agents (parallel or sequential based on phase config)
        await executeAgents(
          phase.agents,
          phase.runInParallel,
          this.context,
          context.tenantId,
          context.jobId,
          model
        );

        // Always push progress to the job as soon as a phase finishes,
        // so a failure in reasoning won't lose the completion update.
        if (onPhaseComplete) {
          try {
            await onPhaseComplete(phase.name, this.getAllAgentSummaries());
          } catch (callbackError) {
            console.error(`[Orchestrator] Failed to run onPhaseComplete for ${phase.name}:`, callbackError);
          }
        }

        // Reason over results after each phase (best-effort; don't block progress)
        let reasoning: Awaited<ReturnType<typeof reasonOverResults>> | null = null;
        try {
          reasoning = await reasonOverResults(
            this.context.getContext(),
            context.tenantId,
            context.jobId,
            model
          );
          console.log(`[Orchestrator] Phase ${phase.name} completed. Insights:`, reasoning.insights);
        } catch (reasonError) {
          console.error(`[Orchestrator] Phase ${phase.name} reasoning failed (continuing):`, reasonError);
        }

        // Apply adjustments if suggested
        if (reasoning && reasoning.adjustments && reasoning.adjustments.length > 0) {
          console.log(`[Orchestrator] Adjustments suggested:`, reasoning.adjustments);
          // Could modify plan here if needed
        }

        // Log reasoning suggestion but don't stop early - complete all planned phases
        if (reasoning && !reasoning.shouldContinue) {
          console.log(`[Orchestrator] Reasoning suggests stopping, but continuing with remaining phases. Next steps:`, reasoning.nextSteps);
          // Don't break - always complete all planned phases
        }

        // Compress context if approaching limit
        if (this.context.isApproachingLimit()) {
          console.log(`[Orchestrator] Compressing context...`);
          await this.context.compressContext(model);
        }
      } catch (error) {
        console.error(`[Orchestrator] Phase ${phase.name} failed:`, error);
        // Mark failed agents
        for (const agentId of phase.agents) {
          this.context.markAgentFailed(agentId, (error as Error).message);
        }
        throw error;
      }
    }
  }

  /**
   * Get current context
   */
  getContext(): AgentContext {
    return this.context.getContext();
  }

  /**
   * Get context manager (for storing initial data like pages)
   */
  getContextManager(): ContextManager {
    return this.context;
  }

  /**
   * Get execution plan
   */
  getPlan(): ExecutionPlan | null {
    return this.plan;
  }

  /**
   * Check if full data should be retrieved for an agent
   */
  shouldRetrieveFullData(agentId: string): boolean {
    const summary = this.context.getAgentSummary(agentId);
    if (!summary) return false;

    // Retrieve full data if:
    // 1. Agent failed and we need to debug
    // 2. Metrics indicate something critical
    // 3. Next steps suggest we need more detail
    if (summary.status === 'failed') return true;
    if (summary.nextSteps && summary.nextSteps.length > 0) return true;

    return false;
  }
}
