import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { messageTemplates } from "../schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export const messageTemplatesRouter = router({
  // List all templates for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const templates = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.userId, ctx.user.id));

    return templates;
  }),

  // Get single template by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [template] = await db
        .select()
        .from(messageTemplates)
        .where(
          and(
            eq(messageTemplates.id, input.id),
            eq(messageTemplates.userId, ctx.user.id)
          )
        )
        .limit(1);

      return template || null;
    }),

  // Create new template
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        subject: z.string().max(512).optional(),
        body: z.string().min(1),
        category: z.enum(["inquiry", "follow_up", "update", "general"]).default("general"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = nanoid();
      await db.insert(messageTemplates).values({
        id,
        userId: ctx.user.id,
        ...input,
      });

      return { id, success: true };
    }),

  // Update existing template
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(256).optional(),
        subject: z.string().max(512).optional(),
        body: z.string().min(1).optional(),
        category: z.enum(["inquiry", "follow_up", "update", "general"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updates } = input;

      await db
        .update(messageTemplates)
        .set(updates)
        .where(
          and(
            eq(messageTemplates.id, id),
            eq(messageTemplates.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // Delete template
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(messageTemplates)
        .where(
          and(
            eq(messageTemplates.id, input.id),
            eq(messageTemplates.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});

