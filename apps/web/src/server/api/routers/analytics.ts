import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  crawlerVisits,
  crawlers,
  siteUrls,
  sites,
  type PostgresDatabase,
} from "@propintel/database";
import { eq, and, gte, desc, count, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Shared filter schema for analytics queries
const filterSchema = z.object({
  siteId: z.string(),
  days: z.number().min(1).max(365).optional(),
  hours: z.number().min(1).max(72).optional(), // For short time ranges (12h, 24h, etc.)
  source: z.enum(["pixel", "middleware"]).optional(),
  companies: z.array(z.string()).optional(),
});

// Helper to get start date from days or hours
function getStartDate(filters: { days?: number; hours?: number }): Date {
  const startDate = new Date();
  if (filters.hours) {
    startDate.setHours(startDate.getHours() - filters.hours);
  } else {
    startDate.setDate(startDate.getDate() - (filters.days ?? 30));
  }
  return startDate;
}

// Helper to build visit filter conditions
async function buildVisitConditions(
  db: PostgresDatabase,
  siteId: string,
  filters: { days?: number; hours?: number; source?: "pixel" | "middleware"; companies?: string[] }
) {
  const startDate = getStartDate(filters);
  const conditions = [
    eq(crawlerVisits.siteId, siteId),
    gte(crawlerVisits.visitedAt, startDate),
  ];

  if (filters.source) {
    conditions.push(eq(crawlerVisits.source, filters.source));
  }

  if (filters.companies?.length) {
    const crawlerIds = await db
      .select({ id: crawlers.id })
      .from(crawlers)
      .where(inArray(crawlers.company, filters.companies));

    if (crawlerIds.length > 0) {
      conditions.push(inArray(crawlerVisits.crawlerId, crawlerIds.map((c) => c.id)));
    } else {
      // No matching crawlers, add impossible condition to return empty results
      conditions.push(eq(crawlerVisits.crawlerId, "__no_match__"));
    }
  }

  return conditions;
}

export const analyticsRouter = createTRPCRouter({
  // Get summary metrics
  getSummary: protectedProcedure
    .input(filterSchema)
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

      const [totalVisits] = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(and(...conditions));

      const [totalUrls] = await ctx.db
        .select({ count: count() })
        .from(siteUrls)
        .where(eq(siteUrls.siteId, input.siteId));

      const uniqueCrawlers = await ctx.db
        .selectDistinct({ crawlerId: crawlerVisits.crawlerId })
        .from(crawlerVisits)
        .where(and(...conditions));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayConditions = [...conditions, gte(crawlerVisits.visitedAt, today)];
      const [visitsToday] = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(and(...todayConditions));

      return {
        totalVisits: totalVisits?.count ?? 0,
        totalUrls: totalUrls?.count ?? 0,
        uniqueCrawlers: uniqueCrawlers.length,
        visitsToday: visitsToday?.count ?? 0,
      };
    }),

  // Get visits by crawler
  getCrawlerStats: protectedProcedure
    .input(filterSchema)
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

      const stats = await ctx.db
        .select({
          crawlerId: crawlerVisits.crawlerId,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(...conditions))
        .groupBy(crawlerVisits.crawlerId);

      // Join with crawler info
      const allCrawlers = await ctx.db.query.crawlers.findMany();
      const crawlerMap = new Map(allCrawlers.map(c => [c.id, c]));

      return stats.map(s => ({
        ...s,
        crawler: crawlerMap.get(s.crawlerId ?? ""),
      }));
    }),

  // Get visit timeline (hourly or daily aggregation based on time range)
  getVisitTimeline: protectedProcedure
    .input(filterSchema)
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

      // Use hourly aggregation for short time ranges (hours specified or days <= 3)
      const useHourly = input.hours || (input.days && input.days <= 3);

      if (useHourly) {
        // Hourly aggregation - returns ISO timestamp for each hour
        const timeline = await ctx.db
          .select({
            date: sql<string>`DATE_TRUNC('hour', ${crawlerVisits.visitedAt})`,
            count: count(),
          })
          .from(crawlerVisits)
          .where(and(...conditions))
          .groupBy(sql`DATE_TRUNC('hour', ${crawlerVisits.visitedAt})`)
          .orderBy(sql`DATE_TRUNC('hour', ${crawlerVisits.visitedAt})`);

        return { data: timeline, aggregation: "hourly" as const };
      }

      // Daily aggregation
      const timeline = await ctx.db
        .select({
          date: sql<string>`DATE(${crawlerVisits.visitedAt})`,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(...conditions))
        .groupBy(sql`DATE(${crawlerVisits.visitedAt})`)
        .orderBy(sql`DATE(${crawlerVisits.visitedAt})`);

      return { data: timeline, aggregation: "daily" as const };
    }),

  // Get top pages (recomputed from visits when filters applied)
  getTopPages: protectedProcedure
    .input(filterSchema.extend({
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

      // When filters are applied, recompute from crawlerVisits
      const hasFilters = input.source || input.companies?.length;

      if (hasFilters) {
        const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

        const topPaths = await ctx.db
          .select({
            path: crawlerVisits.path,
            crawlCount: count(),
          })
          .from(crawlerVisits)
          .where(and(...conditions))
          .groupBy(crawlerVisits.path)
          .orderBy(desc(count()))
          .limit(input.limit);

        // Map to expected shape
        return topPaths.map((p, idx) => ({
          id: `filtered-${idx}`,
          siteId: input.siteId,
          path: p.path,
          title: null,
          firstSeen: new Date(),
          lastCrawled: null,
          crawlCount: p.crawlCount,
        }));
      }

      // Default: use pre-aggregated siteUrls
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

  // Get list of companies that have visited this site (for filter dropdown)
  getCrawlersList: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      // Get all crawlers that have visited this site
      const visitedCrawlerIds = await ctx.db
        .selectDistinct({ crawlerId: crawlerVisits.crawlerId })
        .from(crawlerVisits)
        .where(eq(crawlerVisits.siteId, input.siteId));

      const crawlerIds = visitedCrawlerIds
        .map(v => v.crawlerId)
        .filter(Boolean) as string[];

      if (crawlerIds.length === 0) {
        return { companies: [], crawlers: [] };
      }

      // Get crawler details
      const relevantCrawlers = await ctx.db.query.crawlers.findMany({
        where: inArray(crawlers.id, crawlerIds),
      });

      // Extract unique companies
      const companies = [...new Set(relevantCrawlers.map(c => c.company))].sort();

      return {
        companies,
        crawlers: relevantCrawlers,
      };
    }),
});
