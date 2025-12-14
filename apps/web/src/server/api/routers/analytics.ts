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

  // Get visit timeline grouped by company (for stacked area chart)
  getTimelineByCompany: protectedProcedure
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
      const useHourly = input.hours || (input.days && input.days <= 3);
      const dateExpr = useHourly
        ? sql`DATE_TRUNC('hour', ${crawlerVisits.visitedAt})`
        : sql`DATE(${crawlerVisits.visitedAt})`;

      const timeline = await ctx.db
        .select({
          date: sql<string>`${dateExpr}`,
          company: crawlers.company,
          count: count(),
        })
        .from(crawlerVisits)
        .leftJoin(crawlers, eq(crawlerVisits.crawlerId, crawlers.id))
        .where(and(...conditions))
        .groupBy(dateExpr, crawlers.company)
        .orderBy(dateExpr);

      // Get unique companies
      const companies = [...new Set(timeline.map(t => t.company).filter(Boolean))] as string[];

      // Get all unique dates
      const dates = [...new Set(timeline.map(t => t.date))];

      // Transform to stacked format: { date, OpenAI: X, Anthropic: Y, ... }
      const stackedData = dates.map(date => {
        const entry: Record<string, string | number> = { date };
        for (const company of companies) {
          const match = timeline.find(t => t.date === date && t.company === company);
          entry[company] = match?.count ?? 0;
        }
        return entry;
      });

      return {
        data: stackedData,
        aggregation: useHourly ? "hourly" as const : "daily" as const,
        companies,
      };
    }),

  // Get visit timeline for top URLs (for multi-line chart)
  getTimelineByUrl: protectedProcedure
    .input(filterSchema.extend({ urlLimit: z.number().min(1).max(10).default(5) }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

      // First get top N URLs by visit count
      const topUrls = await ctx.db
        .select({ path: crawlerVisits.path, total: count() })
        .from(crawlerVisits)
        .where(and(...conditions))
        .groupBy(crawlerVisits.path)
        .orderBy(desc(count()))
        .limit(input.urlLimit);

      const topPaths = topUrls.map(u => u.path);

      if (topPaths.length === 0) {
        return { data: [], aggregation: "daily" as const, urls: [] };
      }

      const useHourly = input.hours || (input.days && input.days <= 3);
      const dateExpr = useHourly
        ? sql`DATE_TRUNC('hour', ${crawlerVisits.visitedAt})`
        : sql`DATE(${crawlerVisits.visitedAt})`;

      const timeline = await ctx.db
        .select({
          date: sql<string>`${dateExpr}`,
          path: crawlerVisits.path,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(...conditions, inArray(crawlerVisits.path, topPaths)))
        .groupBy(dateExpr, crawlerVisits.path)
        .orderBy(dateExpr);

      // Get all unique dates
      const dates = [...new Set(timeline.map(t => t.date))];

      // Transform to multi-line format
      const lineData = dates.map(date => {
        const entry: Record<string, string | number> = { date };
        for (const path of topPaths) {
          const match = timeline.find(t => t.date === date && t.path === path);
          entry[path] = match?.count ?? 0;
        }
        return entry;
      });

      return {
        data: lineData,
        aggregation: useHourly ? "hourly" as const : "daily" as const,
        urls: topPaths,
      };
    }),

  // Get activity feed (recent visits with filters applied)
  getActivityFeed: protectedProcedure
    .input(filterSchema.extend({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

      const visits = await ctx.db
        .select({
          id: crawlerVisits.id,
          path: crawlerVisits.path,
          visitedAt: crawlerVisits.visitedAt,
          source: crawlerVisits.source,
          crawlerName: crawlers.name,
          crawlerCompany: crawlers.company,
        })
        .from(crawlerVisits)
        .leftJoin(crawlers, eq(crawlerVisits.crawlerId, crawlers.id))
        .where(and(...conditions))
        .orderBy(desc(crawlerVisits.visitedAt))
        .limit(input.limit);

      return visits;
    }),

  // Get top pages with 7-day trend data for sparklines
  getTopPagesWithTrend: protectedProcedure
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

      const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

      // Get top pages
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

      // Get the siteUrl records for these paths (if they exist)
      const siteUrlRecords = await ctx.db.query.siteUrls.findMany({
        where: and(
          eq(siteUrls.siteId, input.siteId),
          inArray(siteUrls.path, topPaths.map(p => p.path))
        ),
      });
      const urlMap = new Map(siteUrlRecords.map(u => [u.path, u]));

      // Get 7-day trend for each path
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const trendData = await ctx.db
        .select({
          path: crawlerVisits.path,
          date: sql<string>`DATE(${crawlerVisits.visitedAt})`,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(
          eq(crawlerVisits.siteId, input.siteId),
          inArray(crawlerVisits.path, topPaths.map(p => p.path)),
          gte(crawlerVisits.visitedAt, sevenDaysAgo)
        ))
        .groupBy(crawlerVisits.path, sql`DATE(${crawlerVisits.visitedAt})`)
        .orderBy(sql`DATE(${crawlerVisits.visitedAt})`);

      // Build trend arrays for each path
      const trendMap = new Map<string, number[]>();
      for (const path of topPaths.map(p => p.path)) {
        const pathTrends = trendData
          .filter(t => t.path === path)
          .map(t => t.count);
        trendMap.set(path, pathTrends);
      }

      return topPaths.map((p) => {
        const urlRecord = urlMap.get(p.path);
        return {
          id: urlRecord?.id ?? `path-${p.path}`,
          path: p.path,
          crawlCount: p.crawlCount,
          lastCrawled: urlRecord?.lastCrawled ?? null,
          trend: trendMap.get(p.path) ?? [],
        };
      });
    }),

  // Get crawler-page matrix for heatmap
  getCrawlerPageMatrix: protectedProcedure
    .input(filterSchema.extend({
      pageLimit: z.number().min(1).max(20).default(10),
      crawlerLimit: z.number().min(1).max(10).default(5),
    }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const conditions = await buildVisitConditions(ctx.db, input.siteId, input);

      // Get top pages
      const topPages = await ctx.db
        .select({ path: crawlerVisits.path, total: count() })
        .from(crawlerVisits)
        .where(and(...conditions))
        .groupBy(crawlerVisits.path)
        .orderBy(desc(count()))
        .limit(input.pageLimit);

      // Get top crawlers
      const topCrawlerIds = await ctx.db
        .select({ crawlerId: crawlerVisits.crawlerId, total: count() })
        .from(crawlerVisits)
        .where(and(...conditions))
        .groupBy(crawlerVisits.crawlerId)
        .orderBy(desc(count()))
        .limit(input.crawlerLimit);

      const crawlerIds = topCrawlerIds.map(c => c.crawlerId).filter(Boolean) as string[];
      const paths = topPages.map(p => p.path);

      if (crawlerIds.length === 0 || paths.length === 0) {
        return { pages: [], crawlers: [], matrix: [] };
      }

      // Get crawler details
      const crawlerDetails = await ctx.db.query.crawlers.findMany({
        where: inArray(crawlers.id, crawlerIds),
      });
      const crawlerMap = new Map(crawlerDetails.map(c => [c.id, c]));

      // Get matrix data
      const matrixData = await ctx.db
        .select({
          path: crawlerVisits.path,
          crawlerId: crawlerVisits.crawlerId,
          count: count(),
        })
        .from(crawlerVisits)
        .where(and(
          ...conditions,
          inArray(crawlerVisits.path, paths),
          inArray(crawlerVisits.crawlerId, crawlerIds)
        ))
        .groupBy(crawlerVisits.path, crawlerVisits.crawlerId);

      // Build matrix
      const matrix = paths.map(path => {
        return crawlerIds.map(crawlerId => {
          const match = matrixData.find(m => m.path === path && m.crawlerId === crawlerId);
          return match?.count ?? 0;
        });
      });

      return {
        pages: paths,
        crawlers: crawlerIds.map(id => {
          const c = crawlerMap.get(id);
          return { id, name: c?.name ?? "Unknown", company: c?.company ?? "Unknown" };
        }),
        matrix,
      };
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
