import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { siteUrls, sites, crawlerVisits, crawlers } from "@propintel/database";
import { eq, and, desc, count, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const urlRouter = createTRPCRouter({
  // List URLs for a site
  listBySite: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user owns the site
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.query.siteUrls.findMany({
        where: eq(siteUrls.siteId, input.siteId),
        orderBy: [desc(siteUrls.crawlCount), desc(siteUrls.lastCrawled)],
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // Get single URL with stats
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const url = await ctx.db.query.siteUrls.findFirst({
        where: eq(siteUrls.id, input.id),
        with: {
          site: true,
        },
      });

      if (!url || url.site.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return url;
    }),

  // Get crawler visit stats for a URL
  getStats: protectedProcedure
    .input(z.object({ urlId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership through URL -> Site -> User
      const url = await ctx.db.query.siteUrls.findFirst({
        where: eq(siteUrls.id, input.urlId),
        with: { site: true },
      });

      if (!url || url.site.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const visits = await ctx.db
        .select({
          crawlerId: crawlerVisits.crawlerId,
          count: count(),
        })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.urlId, input.urlId))
        .groupBy(crawlerVisits.crawlerId);

      return visits;
    }),

  // Get visit timeline for a specific URL
  getTimeline: protectedProcedure
    .input(z.object({
      urlId: z.string(),
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const url = await ctx.db.query.siteUrls.findFirst({
        where: eq(siteUrls.id, input.urlId),
        with: { site: true },
      });

      if (!url || url.site.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const timeline = await ctx.db
        .select({
          date: sql<string>`DATE(${crawlerVisits.visitedAt})`,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.urlId, input.urlId),
          gte(crawlerVisits.visitedAt, startDate)
        ))
        .groupBy(sql`DATE(${crawlerVisits.visitedAt})`)
        .orderBy(sql`DATE(${crawlerVisits.visitedAt})`);

      return timeline;
    }),

  // Get crawler breakdown for a specific URL
  getCrawlerBreakdown: protectedProcedure
    .input(z.object({ urlId: z.string() }))
    .query(async ({ ctx, input }) => {
      const url = await ctx.db.query.siteUrls.findFirst({
        where: eq(siteUrls.id, input.urlId),
        with: { site: true },
      });

      if (!url || url.site.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const stats = await ctx.db
        .select({
          crawlerId: crawlerVisits.crawlerId,
          count: count(),
        })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.urlId, input.urlId))
        .groupBy(crawlerVisits.crawlerId);

      // Get crawler details
      const allCrawlers = await ctx.db.query.crawlers.findMany();
      const crawlerMap = new Map(allCrawlers.map(c => [c.id, c]));

      return stats.map(s => ({
        ...s,
        crawler: crawlerMap.get(s.crawlerId ?? ""),
      }));
    }),

  // Get recent visits for a specific URL
  getRecentVisits: protectedProcedure
    .input(z.object({
      urlId: z.string(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const url = await ctx.db.query.siteUrls.findFirst({
        where: eq(siteUrls.id, input.urlId),
        with: { site: true },
      });

      if (!url || url.site.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const visits = await ctx.db
        .select({
          id: crawlerVisits.id,
          visitedAt: crawlerVisits.visitedAt,
          source: crawlerVisits.source,
          crawlerName: crawlers.name,
          crawlerCompany: crawlers.company,
        })
        .from(crawlerVisits)
        .leftJoin(crawlers, eq(crawlerVisits.crawlerId, crawlers.id))
        .where(eq(crawlerVisits.urlId, input.urlId))
        .orderBy(desc(crawlerVisits.visitedAt))
        .limit(input.limit);

      return visits;
    }),
});
