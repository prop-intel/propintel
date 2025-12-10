import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { siteUrls, sites, crawlerVisits } from "@/server/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
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
});
