import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { fetchExternal } from "@/lib/fetch-external";

export const trackingRouter = createTRPCRouter({
  // Get tracking script for site
  getScript: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.com";

      return {
        trackingId: site.trackingId,
        // Pixel tracking - works with all AI crawlers because they fetch images
        // but don't execute JavaScript
        pixelTag: `<img src="${baseUrl}/api/pixel/${site.trackingId}" alt="" width="1" height="1" style="position:absolute;opacity:0;pointer-events:none" />`,
      };
    }),

  // Test script installation
  testInstallation: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const response = await fetchExternal(`https://${site.domain}`, {
          userAgent: "PropIntel-Verification/1.0",
        });

        if (!response.ok) {
          return { installed: false, error: `Site returned ${response.status}` };
        }

        const html = await response.text();
        const hasPixel = html.includes(site.trackingId);

        return {
          installed: hasPixel,
          error: hasPixel ? null : "Tracking pixel not found on page",
        };
      } catch (error) {
        console.error(`Failed to test installation for ${site.domain}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch site";
        return {
          installed: false,
          error: `Failed to fetch site: ${errorMessage}`,
        };
      }
    }),

  // Regenerate tracking ID
  regenerateTrackingId: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const newTrackingId = nanoid(16);

      const [site] = await ctx.db
        .update(sites)
        .set({ trackingId: newTrackingId, updatedAt: new Date() })
        .where(and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ))
        .returning();

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      return { trackingId: newTrackingId };
    }),
});
