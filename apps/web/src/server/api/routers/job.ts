import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { api } from "@/lib/api/client";
import { TRPCError } from "@trpc/server";
import { jobs, sites } from "@propintel/database";
import { and, desc, eq } from "drizzle-orm";

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
        siteId: z.string().optional(),
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
            userId: ctx.session.user.id,
            siteId: input.siteId,
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
      const job = await ctx.db.query.jobs.findFirst({
        where: and(
          eq(jobs.id, input.id),
          eq(jobs.userId, ctx.session.user.id)
        ),
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      return job;
    }),

  // List jobs with pagination, optionally filtered by site
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        siteId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Build where conditions
      const conditions = [eq(jobs.userId, ctx.session.user.id)];

      if (input.siteId) {
        // Validate site ownership
        const site = await ctx.db.query.sites.findFirst({
          where: and(
            eq(sites.id, input.siteId),
            eq(sites.userId, ctx.session.user.id)
          ),
        });
        if (!site) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }
        conditions.push(eq(jobs.siteId, input.siteId));
      }

      // Query jobs directly from DB
      const items = await ctx.db.query.jobs.findMany({
        where: and(...conditions),
        orderBy: [desc(jobs.createdAt)],
        limit: input.limit + 1, // Fetch one extra to check hasMore
        offset: input.offset,
      });

      const hasMore = items.length > input.limit;
      if (hasMore) {
        items.pop(); // Remove the extra item
      }

      return {
        items,
        pagination: {
          limit: input.limit,
          offset: input.offset,
          hasMore,
        },
      };
    }),

  // Get job status
  getStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await ctx.db.query.jobs.findFirst({
        where: and(
          eq(jobs.id, input.id),
          eq(jobs.userId, ctx.session.user.id)
        ),
        columns: {
          status: true,
          progress: true,
          metrics: true,
          error: true,
        },
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      return {
        status: job.status,
        progress: job.progress,
        metrics: job.metrics,
        error: job.error,
      };
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
