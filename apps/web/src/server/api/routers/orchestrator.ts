import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getReport } from "@/lib/storage/s3";
import { TRPCError } from "@trpc/server";
import { jobs } from "@propintel/database";
import { and, eq } from "drizzle-orm";

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

export const orchestratorRouter = createTRPCRouter({
  // Get orchestrator status and context for a job
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        // Query job directly from database (faster than HTTP API call)
        const job = await ctx.db.query.jobs.findFirst({
          where: and(
            eq(jobs.id, input.jobId),
            eq(jobs.userId, ctx.session.user.id)
          ),
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job not found",
          });
        }

        // Extract orchestrator data from job progress
        // Note: Orchestrator context may be stored in S3, but we extract what's available from job
        const progress = job.progress as JobProgress | undefined;

        // If job is completed, try to fetch the report for the full summary
        const summary = progress?.summary ?? progress?.orchestratorSummary ?? null;
        let reportSummary = null;

        if (job.status === "completed") {
          try {
            console.log("[orchestrator.getStatus] Fetching report for completed job:", input.jobId);
            const reportContent = await getReport(ctx.session.user.id, input.jobId, "json");
            console.log("[orchestrator.getStatus] Report result received:", !!reportContent);

            if (reportContent) {
              const report = JSON.parse(reportContent) as ReportData;
              console.log("[orchestrator.getStatus] Report parsed, has scores:", !!report.scores, "has llmSummary:", !!report.llmSummary);

              reportSummary = {
                strengths: report.llmSummary?.strengths ?? [],
                weaknesses: report.llmSummary?.weaknesses ?? [],
                opportunities: report.llmSummary?.opportunities ?? [],
                nextSteps: report.llmSummary?.nextSteps ?? [],
                scores: report.scores ?? null,
                recommendations: report.aeoRecommendations ?? report.recommendations ?? [],
                fullReport: report,
              };
              console.log("[orchestrator.getStatus] Report summary built successfully");
            }
          } catch (reportError: unknown) {
            const errorMsg = reportError instanceof Error ? reportError.message : 'Unknown error';
            console.log("[orchestrator.getStatus] Report fetch error:", errorMsg);
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
      // Query job directly from database
      const job = await ctx.db.query.jobs.findFirst({
        where: and(
          eq(jobs.id, input.jobId),
          eq(jobs.userId, ctx.session.user.id)
        ),
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      if (job.status === "completed" || job.status === "failed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Job is already in a terminal state",
        });
      }

      return {
        success: true,
        jobId: input.jobId,
        status: job.status,
        message: "Orchestration is running or will start automatically",
      };
    }),
});
