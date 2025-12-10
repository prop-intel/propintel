import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  parseRobotsTxt,
  isCrawlerAllowed,
  AI_CRAWLER_USER_AGENTS,
} from "@/lib/robots-parser";

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
        const response = await fetch(`https://${site.domain}/robots.txt`, {
          headers: { "User-Agent": "PropIntel-Analyzer/1.0" },
          signal: AbortSignal.timeout(10000),
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
        return {
          found: false,
          error: error instanceof Error ? error.message : "Failed to fetch",
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
        const response = await fetch(`https://${site.domain}/llms.txt`, {
          headers: { "User-Agent": "PropIntel-Analyzer/1.0" },
          signal: AbortSignal.timeout(10000),
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
        return {
          found: false,
          error: error instanceof Error ? error.message : "Failed to fetch",
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
        const response = await fetch(`https://${site.domain}/robots.txt`, {
          headers: { "User-Agent": "PropIntel-Analyzer/1.0" },
          signal: AbortSignal.timeout(10000),
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
      } catch {
        // On error, return unknown status
        return AI_CRAWLER_USER_AGENTS.map((crawler) => ({
          ...crawler,
          status: "unknown" as const,
        }));
      }
    }),
});
