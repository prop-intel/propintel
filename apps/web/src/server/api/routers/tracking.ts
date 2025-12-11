import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "@propintel/database";
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
        inlineScript: `<script>
(function(){
  var ua=navigator.userAgent;
  var bots=['GPTBot','ChatGPT-User','OAI-SearchBot','ClaudeBot','Claude-Web','Claude-SearchBot','anthropic-ai','PerplexityBot','Perplexity-User','Googlebot','Google-Extended','bingbot','Bytespider','cohere-ai','Meta-ExternalAgent','Applebot-Extended'];
  for(var i=0;i<bots.length;i++){
    if(ua.indexOf(bots[i])!==-1){
      var img=new Image();
      img.src='${baseUrl}/api/beacon?tid=${site.trackingId}&ua='+encodeURIComponent(ua)+'&path='+encodeURIComponent(location.pathname)+'&t='+Date.now();
      break;
    }
  }
})();
</script>`,
        externalScript: `<script src="${baseUrl}/api/script/${site.trackingId}"></script>`,
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
        const hasScript = html.includes(site.trackingId);

        return {
          installed: hasScript,
          error: hasScript ? null : "Tracking script not found on page",
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
