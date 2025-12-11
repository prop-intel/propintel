/**
 * Context Manager
 *
 * Manages lightweight in-memory context with summaries while offloading
 * full data to S3. Provides fast access to summaries and on-demand
 * retrieval of full results.
 */

import { storeAgentResult, getAgentResult } from '../../lib/s3';
import { generateAgentSummary, generateBriefSummary } from './summary-generator';

// ===================
// Types
// ===================

export interface AgentSummary {
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: string; // LLM-generated summary
  keyFindings: string[];
  metrics: Record<string, number>;
  s3Key?: string; // Full data location in S3
  completedAt?: string;
  nextSteps?: string[];
}

export interface AgentContext {
  jobId: string;
  tenantId: string;
  domain: string;
  summaries: {
    [agentId: string]: AgentSummary;
  };
  s3References: {
    [agentId: string]: string; // S3 key
  };
  metadata: {
    createdAt: string;
    lastUpdated: string;
    tokenEstimate: number;
  };
}

// ===================
// Context Manager Class
// ===================

export class ContextManager {
  private context: AgentContext;

  constructor(jobId: string, tenantId: string, domain: string) {
    this.context = {
      jobId,
      tenantId,
      domain,
      summaries: {},
      s3References: {},
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        tokenEstimate: 0,
      },
    };
  }

  /**
   * Store agent result: save full data to S3, generate summary, keep summary in memory
   */
  async storeAgentResult(
    agentId: string,
    result: unknown,
    model: string = 'gpt-4o-mini'
  ): Promise<void> {
    // Store full result in S3
    const s3Key = await storeAgentResult(
      this.context.tenantId,
      this.context.jobId,
      agentId,
      result
    );

    // Generate summary using LLM
    const summaryData = await generateAgentSummary(
      agentId,
      result,
      this.context.tenantId,
      this.context.jobId,
      model
    );

    // Update context
    this.context.summaries[agentId] = {
      agentId,
      status: summaryData.status === 'failed' ? 'failed' : 'completed',
      summary: summaryData.summary,
      keyFindings: summaryData.keyFindings,
      metrics: summaryData.metrics,
      s3Key,
      completedAt: new Date().toISOString(),
      nextSteps: summaryData.nextSteps,
    };

    this.context.s3References[agentId] = s3Key;
    this.context.metadata.lastUpdated = new Date().toISOString();
    this.updateTokenEstimate();
  }

  /**
   * Get in-memory summary (fast, no S3 call)
   */
  getAgentSummary(agentId: string): AgentSummary | undefined {
    return this.context.summaries[agentId];
  }

  /**
   * Retrieve full result from S3 (slower, on-demand)
   */
  async getAgentResult<T = unknown>(agentId: string): Promise<T | null> {
    const s3Key = this.context.s3References[agentId];
    if (!s3Key) {
      return null;
    }

    return await getAgentResult<T>(this.context.tenantId, this.context.jobId, agentId);
  }

  /**
   * Get all summaries (for orchestrator planning)
   */
  getAllSummaries(): Record<string, AgentSummary> {
    return { ...this.context.summaries };
  }

  /**
   * Get full context
   */
  getContext(): AgentContext {
    return { ...this.context };
  }

  /**
   * Mark agent as running
   */
  markAgentRunning(agentId: string): void {
    if (!this.context.summaries[agentId]) {
      this.context.summaries[agentId] = {
        agentId,
        status: 'running',
        summary: '',
        keyFindings: [],
        metrics: {},
      };
    } else {
      this.context.summaries[agentId].status = 'running';
    }
    this.context.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Mark agent as failed
   */
  markAgentFailed(agentId: string, error: string): void {
    this.context.summaries[agentId] = {
      agentId,
      status: 'failed',
      summary: `Agent failed: ${error}`,
      keyFindings: [],
      metrics: {},
    };
    this.context.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Compress context by summarizing older results more aggressively
   */
  async compressContext(model: string = 'gpt-4o-mini'): Promise<void> {
    const summaries = Object.values(this.context.summaries);
    const completedSummaries = summaries.filter(s => s.status === 'completed');

    // If we have many completed summaries, compress the oldest ones
    if (completedSummaries.length > 5) {
      // Sort by completion time (oldest first)
      const sorted = completedSummaries
        .filter(s => s.completedAt)
        .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''));

      // Compress oldest 30%
      const toCompress = sorted.slice(0, Math.floor(sorted.length * 0.3));

      for (const summary of toCompress) {
        // Generate brief summary if we have full data
        if (summary.s3Key) {
          const fullResult = await this.getAgentResult(summary.agentId);
          if (fullResult) {
            const briefSummary = await generateBriefSummary(
              summary.agentId,
              fullResult,
              this.context.tenantId,
              this.context.jobId,
              model
            );
            summary.summary = briefSummary;
            summary.keyFindings = summary.keyFindings.slice(0, 2); // Keep only top 2
          }
        }
      }
    }

    this.updateTokenEstimate();
  }

  /**
   * Estimate token count in context (rough approximation)
   */
  private updateTokenEstimate(): void {
    const contextJson = JSON.stringify(this.context);
    // Rough estimate: 1 token ≈ 4 characters
    this.context.metadata.tokenEstimate = Math.ceil(contextJson.length / 4);
  }

  /**
   * Check if context is approaching token limit
   */
  isApproachingLimit(limit: number = 100000): boolean {
    return this.context.metadata.tokenEstimate > limit * 0.8;
  }
}
