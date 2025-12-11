import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sites } from "@propintel/database";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";

export const siteRouter = createTRPCRouter({
  // List all sites for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.sites.findMany({
      where: eq(sites.userId, ctx.session.user.id),
      orderBy: (sites, { desc }) => [desc(sites.createdAt)],
    });
  }),

  // Get single site by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.db.query.sites.findFirst({
        where: and(
          eq(sites.id, input.id),
          eq(sites.userId, ctx.session.user.id)
        ),
      });
      if (!site) throw new TRPCError({ code: "NOT_FOUND" });
      return site;
    }),

  // Create new site
  create: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1).transform((val) => {
          // Normalize domain: remove protocol, www, trailing slash
          return val
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .replace(/\/$/, "")
            .toLowerCase();
        }),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trackingId = nanoid(16);
      const [site] = await ctx.db
        .insert(sites)
        .values({
          userId: ctx.session.user.id,
          domain: input.domain,
          name: input.name ?? input.domain,
          trackingId,
        })
        .returning();
      return site;
    }),

  // Update site
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [site] = await ctx.db
        .update(sites)
        .set({ name: input.name, updatedAt: new Date() })
        .where(
          and(eq(sites.id, input.id), eq(sites.userId, ctx.session.user.id))
        )
        .returning();
      return site;
    }),

  // Delete site
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(sites)
        .where(
          and(eq(sites.id, input.id), eq(sites.userId, ctx.session.user.id))
        );
      return { success: true };
    }),
});
