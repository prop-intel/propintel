import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { api } from "@/lib/api/client";
import { TRPCError } from "@trpc/server";

// Helper to extract cookie header from tRPC context
function getCookieFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  return cookieHeader;
}

export const jobRouter = createTRPCRouter({
  // Create a new analysis job
  create: protectedProcedure
    .input(
      z.object({
        targetUrl: z.string().url(),
        config: z
          .object({
            maxPages: z.number().min(1).max(100).optional(),
            maxDepth: z.number().min(1).max(10).optional(),
            pageTimeout: z.number().optional(),
            crawlDelay: z.number().optional(),
            maxJobDuration: z.number().optional(),
            viewport: z
              .object({
                width: z.number(),
                height: z.number(),
              })
              .optional(),
            userAgent: z.string().optional(),
            followCanonical: z.boolean().optional(),
            respectRobotsTxt: z.boolean().optional(),
            skipExactDuplicates: z.boolean().optional(),
            urlExclusions: z.array(z.string()).optional(),
            maxFileSize: z.number().optional(),
          })
          .optional(),
        competitors: z.array(z.string().url()).optional(),
        webhookUrl: z.string().url().optional(),
        llmModel: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        const result = await api.jobs.create(
          {
            targetUrl: input.targetUrl,
            config: input.config,
            competitors: input.competitors,
            webhookUrl: input.webhookUrl,
            llmModel: input.llmModel,
          },
          cookie
        );
        return result.job;
      } catch (error) {
        console.error("Failed to create job:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to create job",
        });
      }
    }),

  // Get job by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        const result = await api.jobs.get(input.id, cookie);
        return result.job;
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
            error instanceof Error ? error.message : "Failed to get job",
        });
      }
    }),

  // List jobs with pagination
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        const result = await api.jobs.list(input.limit, input.offset, cookie);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to list jobs",
        });
      }
    }),

  // Get job status
  getStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        const result = await api.jobs.get(input.id, cookie);
        return {
          status: result.job.status,
          progress: result.job.progress,
          metrics: result.job.metrics,
          error: result.job.error,
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
            error instanceof Error ? error.message : "Failed to get job status",
        });
      }
    }),

  // Get report (JSON or Markdown)
  getReport: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        format: z.enum(["json", "md"]).default("json"),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        const result = await api.jobs.getReport(input.id, input.format, cookie);
        return result;
      } catch (error) {
        if (error instanceof Error && error.message.includes("404")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found",
          });
        }
        if (
          error instanceof Error &&
          error.message.includes("not completed")
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Job is not completed yet",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to get report",
        });
      }
    }),
});
