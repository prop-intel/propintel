import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites, jobs } from "@propintel/database";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  generateLlmsTxt,
  generateLlmsFullTxt,
} from "@/lib/llms-txt-generator";
import { getPageData, listSnapshots, type CrawledPageData } from "@/lib/storage/s3";

export const llmsTxtRouter = createTRPCRouter({
  // Get completed jobs for a site (for job selector dropdown)
  getCompletedJobs: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
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

      // Get completed jobs for this site
      const completedJobs = await ctx.db.query.jobs.findMany({
        where: and(
          eq(jobs.siteId, input.siteId),
          eq(jobs.userId, ctx.session.user.id),
          eq(jobs.status, "completed")
        ),
        orderBy: [desc(jobs.createdAt)],
        columns: {
          id: true,
          createdAt: true,
          progress: true,
        },
      });

      return completedJobs.map((job) => ({
        id: job.id,
        createdAt: job.createdAt,
        pageCount: job.progress?.pagesCrawled ?? 0,
      }));
    }),

  // Generate llms.txt from a job's crawled pages (mutation since it's triggered by button)
  generate: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        jobId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Find the job
      const job = await ctx.db.query.jobs.findFirst({
        where: and(
          eq(jobs.id, input.jobId),
          eq(jobs.siteId, input.siteId),
          eq(jobs.userId, ctx.session.user.id),
          eq(jobs.status, "completed")
        ),
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No completed analysis found for this site",
        });
      }

      // Fetch crawled pages from S3 using job.userId (matches how data was stored)
      let pages = await getPageData(job.userId, job.id);

      // If pages.json doesn't exist, try listing snapshots folder as fallback
      if (!pages || pages.length === 0) {
        const snapshotUrls = await listSnapshots(job.userId, job.id);

        if (snapshotUrls.length > 0) {
          // Build minimal page data from snapshot URLs
          pages = snapshotUrls.map((url): CrawledPageData => ({ url }));
        }
      }

      if (!pages || pages.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No pages found in this analysis. The crawl data may not have been saved.",
        });
      }

      const siteName = site.name ?? site.domain;

      // Generate both variants
      const llmsTxt = generateLlmsTxt(pages, siteName, site.domain);
      const llmsFullTxt = generateLlmsFullTxt(pages, siteName, site.domain);

      return {
        llmsTxt,
        llmsFullTxt,
        jobId: job.id,
        jobDate: job.createdAt,
        pageCount: pages.length,
      };
    }),
});
