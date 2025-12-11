import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { api } from "@/lib/api/client";
import { TRPCError } from "@trpc/server";

// Type for job progress data from the API
interface JobProgress {
  currentPhase?: string;
  summary?: unknown;
  orchestratorSummary?: unknown;
  phases?: unknown[];
  agentSummaries?: Record<string, unknown>;
  agentStatuses?: Record<string, unknown>;
  executionPlan?: unknown;
}

// Type for report data
interface ReportData {
  scores?: unknown;
  llmSummary?: {
    strengths?: unknown[];
    weaknesses?: unknown[];
    opportunities?: unknown[];
    nextSteps?: unknown[];
  };
  aeoRecommendations?: unknown[];
  recommendations?: unknown[];
}

// Helper to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

// Helper to safely get error code
function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code);
  }
  return '';
}

// Helper to extract cookie header from tRPC context
function getCookieFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  return cookieHeader;
}

export const orchestratorRouter = createTRPCRouter({
  // Get orchestrator status and context for a job
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        
        // Try to get the job, with retry logic in case it was just created
        let result;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            result = await api.jobs.get(input.jobId, cookie);
            break; // Success, exit retry loop
          } catch (error: unknown) {
            attempts++;
            // If it's a 404 and we haven't exhausted retries, wait and retry
            const errMsg = getErrorMessage(error);
            if (errMsg.includes("404") || errMsg.includes("not found")) {
              if (attempts < maxAttempts) {
                // Wait a bit before retrying (job might be propagating)
                await new Promise(resolve => setTimeout(resolve, 500 * attempts));
                continue;
              }
            }
            // Re-throw if it's not a 404 or we've exhausted retries
            throw error;
          }
        }
        
        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found after retries",
          });
        }
        
        // Extract orchestrator-related data from job
        // The orchestrator context is stored in the job's progress/metadata
        const job = result.job;
        
        // Extract orchestrator data from job progress
        // Note: Orchestrator context may be stored in S3, but we extract what's available from job
        const progress = job.progress as JobProgress | undefined;

        // If job is completed, try to fetch the report for the full summary
        const summary = progress?.summary ?? progress?.orchestratorSummary ?? null;
        let reportSummary = null;
        
        if (job.status === "completed") {
          // Try to fetch the report - it might not be ready immediately after completion
          try {
            console.log("[orchestrator.getStatus] Fetching report for completed job:", input.jobId);
            const reportResult = await api.jobs.getReport(input.jobId, "json", cookie);
            console.log("[orchestrator.getStatus] Report result received:", !!reportResult, typeof reportResult);
            if (reportResult) {
              const report = (typeof reportResult === "string" ? JSON.parse(reportResult) : reportResult) as ReportData;
              console.log("[orchestrator.getStatus] Report parsed, has scores:", !!report.scores, "has llmSummary:", !!report.llmSummary);

              // Format the LLM summary into a readable format
              reportSummary = {
                strengths: report.llmSummary?.strengths ?? [],
                weaknesses: report.llmSummary?.weaknesses ?? [],
                opportunities: report.llmSummary?.opportunities ?? [],
                nextSteps: report.llmSummary?.nextSteps ?? [],
                scores: report.scores ?? null,
                recommendations: report.aeoRecommendations ?? report.recommendations ?? [],
                // Include full report for debugging/display
                fullReport: report,
              };
              console.log("[orchestrator.getStatus] Report summary built successfully");
            }
          } catch (reportError: unknown) {
            // Report might not be ready yet - this is expected and we'll keep polling
            const errorCode = getErrorCode(reportError);
            const errorMsg = getErrorMessage(reportError);
            console.log("[orchestrator.getStatus] Report fetch error:", errorCode, errorMsg);

            const isExpectedError = ['NOT_FOUND', 'PRECONDITION_FAILED', 'HTTP_404', 'HTTP_400'].includes(errorCode) ||
                                   errorCode.includes('not completed') ||
                                   errorCode.includes('not found') ||
                                   errorMsg.includes('not found') ||
                                   errorMsg.includes('404');
            
            // Log all errors for now to help debug
            if (!isExpectedError) {
              console.error("[orchestrator.getStatus] Unexpected report error:", reportError);
            }
            // Return null summary so frontend knows to keep polling
            reportSummary = null;
          }
        }
        
        return {
          jobId: input.jobId,
          status: job.status,
          currentPhase: job.progress?.currentPhase ?? "pending",
          phases: progress?.phases ?? [],
          agentSummaries: progress?.agentSummaries ?? progress?.agentStatuses ?? {},
          executionPlan: progress?.executionPlan ?? null,
          summary: reportSummary ?? summary,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("404")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to get orchestrator status",
        });
      }
    }),

  // Trigger orchestration for a job (if not already running)
  trigger: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        // For now, orchestration is triggered automatically when a job is created
        // This endpoint can be used to re-trigger or check status
        const result = await api.jobs.get(input.jobId, cookie);
        
        if (result.job.status === "completed" || result.job.status === "failed") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Job is already in a terminal state",
          });
        }

        return {
          success: true,
          jobId: input.jobId,
          status: result.job.status,
          message: "Orchestration is running or will start automatically",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to trigger orchestration",
        });
      }
    }),
});
