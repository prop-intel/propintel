/**
 * Context Manager
 *
 * Manages lightweight in-memory context with summaries while offloading
 * full data to S3. Provides fast access to summaries and on-demand
 * retrieval of full results.
 */

import { storeAgentResult, getAgentResult } from "../../lib/s3";
import {
  generateAgentSummary,
  generateBriefSummary,
} from "./summary-generator";

// ===================
// Types
// ===================

export interface AgentSummary {
  agentId: string;
  status: "pending" | "running" | "completed" | "failed";
  summary: string; // LLM-generated summary
  keyFindings: string[];
  metrics: Record<string, unknown>;
  s3Key?: string; // Full data location in S3
  completedAt?: string;
  nextSteps?: string[];
}

export interface AgentContext {
  jobId: string;
  tenantId: string;
  domain: string;
  summaries: Record<string, AgentSummary>;
  s3References: Record<string, string>;
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
   * Store agent result: save full data to S3, mark completed immediately,
   * then generate summary in background (non-blocking).
   */
  async storeAgentResult(
    agentId: string,
    result: unknown,
    model = "gpt-4o-mini",
  ): Promise<void> {
    console.log(`[Context] Storing result for agent: ${agentId}`);

    try {
      // Store full result in S3 (keep blocking - fast operation, ~1s)
      const s3Key = await storeAgentResult(
        this.context.tenantId,
        this.context.jobId,
        agentId,
        result,
      );
      console.log(`[Context] S3 upload complete for ${agentId}: ${s3Key}`);

      // Mark as completed IMMEDIATELY with placeholder summary
      // This allows the next agent to start without waiting for LLM summary generation
      this.context.summaries[agentId] = {
        agentId,
        status: "completed",
        summary: `Agent ${agentId} completed successfully`, // Placeholder
        keyFindings: [],
        metrics: {},
        s3Key,
        completedAt: new Date().toISOString(),
        nextSteps: [],
      };

      this.context.s3References[agentId] = s3Key;
      this.context.metadata.lastUpdated = new Date().toISOString();
      this.updateTokenEstimate();

      console.log(
        `[Context] Agent ${agentId} marked as COMPLETED immediately. Current summaries: ${Object.keys(
          this.context.summaries,
        )
          .map((k) => `${k}:${this.context.summaries[k]?.status}`)
          .join(", ")}`,
      );

      // Fire-and-forget: Generate summary in background (NON-BLOCKING)
      // This allows the pipeline to continue while summaries are generated
      this.generateSummaryInBackground(agentId, result, model);
    } catch (error) {
      console.error(`[Context] Failed to store result for ${agentId}:`, error);
      throw error; // Ensure errors propagate
    }
  }

  /**
   * Generate summary in background and update context when ready.
   * Does NOT block agent execution - the pipeline continues immediately.
   */
  private generateSummaryInBackground(
    agentId: string,
    result: unknown,
    model: string,
  ): void {
    generateAgentSummary(
      agentId,
      result,
      this.context.tenantId,
      this.context.jobId,
      model,
    )
      .then((summaryData) => {
        // Update summary in context when ready
        const existingSummary = this.context.summaries[agentId];
        if (existingSummary) {
          existingSummary.summary = summaryData.summary;
          existingSummary.keyFindings = summaryData.keyFindings;
          existingSummary.metrics = summaryData.metrics;
          existingSummary.nextSteps = summaryData.nextSteps;
          console.log(`[Context] Background summary updated for ${agentId}`);
        }
      })
      .catch((err) => {
        console.warn(
          `[Context] Background summary failed for ${agentId}:`,
          (err as Error).message,
        );
        // Keep placeholder summary - don't throw, pipeline already continued
      });
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

    return await getAgentResult<T>(
      this.context.tenantId,
      this.context.jobId,
      agentId,
    );
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
    console.log(`[Context] Marking agent as running: ${agentId}`);
    if (!this.context.summaries[agentId]) {
      this.context.summaries[agentId] = {
        agentId,
        status: "running",
        summary: "",
        keyFindings: [],
        metrics: {},
      };
    } else {
      this.context.summaries[agentId].status = "running";
    }
    this.context.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Mark agent as failed
   */
  markAgentFailed(agentId: string, error: string): void {
    this.context.summaries[agentId] = {
      agentId,
      status: "failed",
      summary: `Agent failed: ${error}`,
      keyFindings: [],
      metrics: {},
    };
    this.context.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Compress context by summarizing older results more aggressively
   */
  async compressContext(model = "gpt-4o-mini"): Promise<void> {
    const summaries = Object.values(this.context.summaries);
    const completedSummaries = summaries.filter(
      (s) => s.status === "completed",
    );

    // If we have many completed summaries, compress the oldest ones
    if (completedSummaries.length > 5) {
      // Sort by completion time (oldest first)
      const sorted = completedSummaries
        .filter((s) => s.completedAt)
        .sort((a, b) =>
          (a.completedAt || "").localeCompare(b.completedAt || ""),
        );

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
              model,
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
  isApproachingLimit(limit = 100000): boolean {
    return this.context.metadata.tokenEstimate > limit * 0.8;
  }
}
