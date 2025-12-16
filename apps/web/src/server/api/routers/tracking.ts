import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites, crawlerVisits, unmatchedUserAgents } from "@propintel/database";
import { eq, and, gte, count, like } from "drizzle-orm";
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
        pixelSnippet: `<img src="${baseUrl}/api/pixel/${site.trackingId}" alt="" style="position:absolute;width:0;height:0;border:0" />`,
        middlewareSnippet: `// Next.js middleware.ts
import { NextResponse, NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? '';
  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? '';

  // Fire-and-forget tracking call
  fetch('${baseUrl}/api/middleware-track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackingId: '${site.trackingId}',
      userAgent: ua,
      path: request.nextUrl.pathname,
      ip: ip,
    }),
  }).catch(() => {});

  return NextResponse.next();
}`,
        // Keep for backwards compatibility
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

  // Test pixel installation
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

  // Test middleware installation
  testMiddleware: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      // Generate unique test user agent with timestamp
      const timestamp = Date.now();
      const testUserAgent = `PropIntel-Middleware-Test-${timestamp}`;

      try {
        // Make a request to the user's site with the test user agent
        const response = await fetchExternal(`https://${site.domain}`, {
          userAgent: testUserAgent,
        });

        if (!response.ok) {
          return {
            installed: false,
            error: `Could not reach your site. Check if it's online. (HTTP ${response.status})`,
            testUserAgent,
          };
        }

        // Wait 4 seconds for middleware to process and send tracking event
        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Query for tracking event with our test user agent
        // Check both crawlerVisits and unmatchedUserAgents since test user agent
        // won't match known crawlers and will be recorded in unmatchedUserAgents
        const tenSecondsAgo = new Date();
        tenSecondsAgo.setSeconds(tenSecondsAgo.getSeconds() - 10);

        // Check crawlerVisits first
        const visitResult = await ctx.db
          .select()
          .from(crawlerVisits)
          .where(
            and(
              eq(crawlerVisits.siteId, input.siteId),
              eq(crawlerVisits.source, "middleware"),
              like(crawlerVisits.userAgent, `%${testUserAgent}%`),
              gte(crawlerVisits.visitedAt, tenSecondsAgo)
            )
          )
          .limit(1);

        if (visitResult.length > 0) {
          return {
            installed: true,
            error: null,
            testUserAgent,
          };
        }

        // Check unmatchedUserAgents (where test user agent will be recorded)
        const unmatchedResult = await ctx.db
          .select()
          .from(unmatchedUserAgents)
          .where(
            and(
              eq(unmatchedUserAgents.siteId, input.siteId),
              eq(unmatchedUserAgents.source, "middleware"),
              like(unmatchedUserAgents.userAgent, `%${testUserAgent}%`),
              gte(unmatchedUserAgents.createdAt, tenSecondsAgo)
            )
          )
          .limit(1);

        if (unmatchedResult.length > 0) {
          return {
            installed: true,
            error: null,
            testUserAgent,
          };
        }

        // Check if there are any recent middleware visits (wrong user agent)
        const recentMiddlewareResult = await ctx.db
          .select()
          .from(crawlerVisits)
          .where(
            and(
              eq(crawlerVisits.siteId, input.siteId),
              eq(crawlerVisits.source, "middleware"),
              gte(crawlerVisits.visitedAt, tenSecondsAgo)
            )
          )
          .limit(1);

        if (recentMiddlewareResult.length > 0) {
          return {
            installed: false,
            error: "Tracking detected but not from middleware. Check your configuration.",
            testUserAgent,
          };
        }

        return {
          installed: false,
          error: "Middleware not detected. Make sure you've installed the code and deployed your changes.",
          testUserAgent,
        };
      } catch (error) {
        console.error(`Failed to test middleware installation for ${site.domain}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch site";

        // Check if it's a network/connection error
        if (errorMessage.includes("timeout") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
          return {
            installed: false,
            error: "Could not reach your site. Check if it's online.",
            testUserAgent,
          };
        }

        return {
          installed: false,
          error: `Failed to test installation: ${errorMessage}`,
          testUserAgent,
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

  // Get tracking status based on actual visits
  getTrackingStatus: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify site ownership
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      // Check for visits in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query for pixel visits
      const pixelResult = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(
          and(
            eq(crawlerVisits.siteId, input.siteId),
            eq(crawlerVisits.source, "pixel"),
            gte(crawlerVisits.visitedAt, thirtyDaysAgo)
          )
        );

      // Query for middleware visits
      const middlewareResult = await ctx.db
        .select({ count: count() })
        .from(crawlerVisits)
        .where(
          and(
            eq(crawlerVisits.siteId, input.siteId),
            eq(crawlerVisits.source, "middleware"),
            gte(crawlerVisits.visitedAt, thirtyDaysAgo)
          )
        );

      const pixelCount = pixelResult[0]?.count ?? 0;
      const middlewareCount = middlewareResult[0]?.count ?? 0;

      return {
        hasPixel: pixelCount > 0,
        hasMiddleware: middlewareCount > 0,
        pixelCount,
        middlewareCount,
      };
    }),
});
