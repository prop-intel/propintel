import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { api } from "@/lib/api/client";
import { TRPCError } from "@trpc/server";

// Helper to extract cookie header from tRPC context
function getCookieFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  return cookieHeader;
}

export const dashboardRouter = createTRPCRouter({
  // Get dashboard summary with overview, recent jobs, top domains, and alerts
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    try {
      const cookie = getCookieFromHeaders(ctx.headers);
      const summary = await api.dashboard.getSummary(cookie);
      return summary;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to get dashboard summary",
      });
    }
  }),

  // Get score trends over time
  getTrends: protectedProcedure
    .input(
      z.object({
        domain: z.string().optional(),
        days: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const cookie = getCookieFromHeaders(ctx.headers);
        const trends = await api.dashboard.getTrends(
          input.domain,
          input.days,
          cookie
        );
        return trends;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to get trends",
        });
      }
    }),

  // Get all alerts
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    try {
      const cookie = getCookieFromHeaders(ctx.headers);
      const result = await api.dashboard.getAlerts(cookie);
      return result.alerts;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to get alerts",
      });
    }
  }),
});
