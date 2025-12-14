import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { unmatchedUserAgents } from "@propintel/database";
import { eq, desc, count, gte, and, like } from "drizzle-orm";

export const adminRouter = createTRPCRouter({
  getUnmatchedUserAgents: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const conditions = [gte(unmatchedUserAgents.createdAt, startDate)];

      if (input.search) {
        conditions.push(like(unmatchedUserAgents.userAgent, `%${input.search}%`));
      }

      const [items, totalResult] = await Promise.all([
        ctx.db.query.unmatchedUserAgents.findMany({
          where: and(...conditions),
          orderBy: [desc(unmatchedUserAgents.createdAt)],
          limit: input.limit,
          offset: input.offset,
          with: {
            site: {
              columns: {
                domain: true,
                name: true,
              },
            },
          },
        }),
        ctx.db
          .select({ count: count() })
          .from(unmatchedUserAgents)
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        hasMore: input.offset + items.length < (totalResult[0]?.count ?? 0),
      };
    }),

  getUnmatchedStats: adminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const [totalResult, bySourceResult] = await Promise.all([
        ctx.db
          .select({ count: count() })
          .from(unmatchedUserAgents)
          .where(gte(unmatchedUserAgents.createdAt, startDate)),
        ctx.db
          .select({
            source: unmatchedUserAgents.source,
            count: count(),
          })
          .from(unmatchedUserAgents)
          .where(gte(unmatchedUserAgents.createdAt, startDate))
          .groupBy(unmatchedUserAgents.source),
      ]);

      return {
        total: totalResult[0]?.count ?? 0,
        bySource: bySourceResult,
      };
    }),

  deleteUnmatchedUserAgent: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(unmatchedUserAgents)
        .where(eq(unmatchedUserAgents.id, input.id));
      return { success: true };
    }),

  deleteAllUnmatched: adminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      await ctx.db
        .delete(unmatchedUserAgents)
        .where(gte(unmatchedUserAgents.createdAt, startDate));
      return { success: true };
    }),
});
