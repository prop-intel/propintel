import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "../../../../shared/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  parseRobotsTxt,
  isCrawlerAllowed,
  AI_CRAWLER_USER_AGENTS,
} from "@/lib/robots-parser";
import { fetchExternal } from "@/lib/fetch-external";

export const robotsRouter = createTRPCRouter({
  // Fetch and parse robots.txt
  fetchRobotsTxt: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const response = await fetchExternal(`https://${site.domain}/robots.txt`, {
          userAgent: "PropIntel-Analyzer/1.0",
        });

        if (!response.ok) {
          if (response.status === 404) {
            return { found: false, error: "robots.txt not found", content: null, parsed: null };
          }
          return { found: false, error: `HTTP ${response.status}`, content: null, parsed: null };
        }

        const content = await response.text();
        const parsed = parseRobotsTxt(content);

        return { found: true, error: null, content, parsed };
      } catch (error) {
        console.error(`Failed to fetch robots.txt for ${site.domain}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch";
        return {
          found: false,
          error: `Failed to fetch robots.txt: ${errorMessage}`,
          content: null,
          parsed: null,
        };
      }
    }),

  // Fetch llms.txt
  fetchLlmsTxt: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const response = await fetchExternal(`https://${site.domain}/llms.txt`, {
          userAgent: "PropIntel-Analyzer/1.0",
        });

        if (!response.ok) {
          if (response.status === 404) {
            return { found: false, error: "llms.txt not found", content: null };
          }
          return { found: false, error: `HTTP ${response.status}`, content: null };
        }

        const content = await response.text();
        return { found: true, error: null, content };
      } catch (error) {
        console.error(`Failed to fetch llms.txt for ${site.domain}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch";
        return {
          found: false,
          error: `Failed to fetch llms.txt: ${errorMessage}`,
          content: null,
        };
      }
    }),

  // Analyze crawler permissions
  analyzePermissions: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.siteId),
          eq(sites.userId, ctx.session.user.id)
        ),
      });

      if (!site) throw new TRPCError({ code: "NOT_FOUND" });

      try {
        const response = await fetchExternal(`https://${site.domain}/robots.txt`, {
          userAgent: "PropIntel-Analyzer/1.0",
        });

        if (!response.ok) {
          // No robots.txt = all allowed
          return AI_CRAWLER_USER_AGENTS.map((crawler) => ({
            ...crawler,
            status: "allowed" as const,
          }));
        }

        const content = await response.text();
        const parsed = parseRobotsTxt(content);

        return AI_CRAWLER_USER_AGENTS.map((crawler) => ({
          ...crawler,
          status: isCrawlerAllowed(parsed, crawler.userAgent),
        }));
      } catch (error) {
        console.error(`Failed to analyze permissions for ${site.domain}:`, error);
        // On error, return unknown status
        return AI_CRAWLER_USER_AGENTS.map((crawler) => ({
          ...crawler,
          status: "unknown" as const,
        }));
      }
    }),
});
