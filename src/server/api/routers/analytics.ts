import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { crawlerVisits, siteUrls, sites } from "@/server/db/schema";
import { eq, and, gte, desc, count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const analyticsRouter = createTRPCRouter({
  // Get summary metrics
  getSummary: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const [totalVisits] = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.siteId, input.siteId));

      const [totalUrls] = await ctx.db
        .select({ count: count() })
        .from(siteUrls)
        .where(eq(siteUrls.siteId, input.siteId));

      const uniqueCrawlers = await ctx.db
        .selectDistinct({ crawlerId: crawlerVisits.crawlerId })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.siteId, input.siteId));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [visitsToday] = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.siteId, input.siteId),
          gte(crawlerVisits.visitedAt, today)
        ));

      return {
        totalVisits: totalVisits?.count ?? 0,
        totalUrls: totalUrls?.count ?? 0,
        uniqueCrawlers: uniqueCrawlers.length,
        visitsToday: visitsToday?.count ?? 0,
      };
    }),

  // Get visits by crawler
  getCrawlerStats: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const stats = await ctx.db
        .select({
          crawlerId: crawlerVisits.crawlerId,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.siteId, input.siteId),
          gte(crawlerVisits.visitedAt, startDate)
        ))
        .groupBy(crawlerVisits.crawlerId);

      // Join with crawler info
      const allCrawlers = await ctx.db.query.crawlers.findMany();
      const crawlerMap = new Map(allCrawlers.map(c => [c.id, c]));

      return stats.map(s => ({
        ...s,
        crawler: crawlerMap.get(s.crawlerId ?? ""),
      }));
    }),

  // Get visit timeline
  getVisitTimeline: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const timeline = await ctx.db
        .select({
          date: sql<string>`DATE(${crawlerVisits.visitedAt})`,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.siteId, input.siteId),
          gte(crawlerVisits.visitedAt, startDate)
        ))
        .groupBy(sql`DATE(${crawlerVisits.visitedAt})`)
        .orderBy(sql`DATE(${crawlerVisits.visitedAt})`);

      return timeline;
    }),

  // Get top pages
  getTopPages: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.siteUrls.findMany({
        where: eq(siteUrls.siteId, input.siteId),
        orderBy: [desc(siteUrls.crawlCount)],
        limit: input.limit,
      });
    }),

  // Get recent visits
  getRecentVisits: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.crawlerVisits.findMany({
        where: eq(crawlerVisits.siteId, input.siteId),
        orderBy: [desc(crawlerVisits.visitedAt)],
        limit: input.limit,
        with: {
          crawler: true,
        },
      });
    }),
});
