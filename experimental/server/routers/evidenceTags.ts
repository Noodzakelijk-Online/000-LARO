import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { evidenceTags, evidenceFileTags, evidenceFiles } from "../schema";
import { eq, and, sql } from "drizzle-orm";

export const evidenceTagsRouter = router({
  /**
   * Get all tags for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const tags = await db
      .select({
        id: evidenceTags.id,
        name: evidenceTags.name,
        color: evidenceTags.color,
        createdAt: evidenceTags.createdAt,
        usageCount: sql<number>`(SELECT COUNT(*) FROM ${evidenceFileTags} WHERE ${evidenceFileTags.tagId} = ${evidenceTags.id})`,
      })
      .from(evidenceTags)
      .where(eq(evidenceTags.userId, ctx.user.id));

    return tags.map((tag) => ({
      ...tag,
      usageCount: Number(tag.usageCount),
    }));
  }),

  /**
   * Create a new tag
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().regex(/^#[0-9A-F]{6}$/i).default("#3b82f6"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tagId = `tag_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db.insert(evidenceTags).values({
        id: tagId,
        userId: ctx.user.id,
        name: input.name,
        color: input.color,
      });

      const [tag] = await db
        .select()
        .from(evidenceTags)
        .where(eq(evidenceTags.id, tagId))
        .limit(1);

      return tag;
    }),

  /**
   * Update a tag
   */
  update: protectedProcedure
    .input(
      z.object({
        tagId: z.string(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updates: any = {};
      if (input.name) updates.name = input.name;
      if (input.color) updates.color = input.color;

      await db
        .update(evidenceTags)
        .set(updates)
        .where(and(eq(evidenceTags.id, input.tagId), eq(evidenceTags.userId, ctx.user.id)));

      const [tag] = await db
        .select()
        .from(evidenceTags)
        .where(eq(evidenceTags.id, input.tagId))
        .limit(1);

      return tag;
    }),

  /**
   * Delete a tag
   */
  delete: protectedProcedure
    .input(
      z.object({
        tagId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // First delete all file-tag associations
      await db.delete(evidenceFileTags).where(eq(evidenceFileTags.tagId, input.tagId));

      // Then delete the tag
      await db
        .delete(evidenceTags)
        .where(and(eq(evidenceTags.id, input.tagId), eq(evidenceTags.userId, ctx.user.id)));

      return { success: true };
    }),

  /**
   * Add tag to evidence file
   */
  addToFile: protectedProcedure
    .input(
      z.object({
        evidenceFileId: z.string(),
        tagId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if file belongs to user
      const [file] = await db
        .select()
        .from(evidenceFiles)
        .where(
          and(
            eq(evidenceFiles.id, input.evidenceFileId),
            eq(evidenceFiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!file) {
        throw new Error("Evidence file not found or access denied");
      }

      // Check if tag already exists on file
      const existing = await db
        .select()
        .from(evidenceFileTags)
        .where(
          and(
            eq(evidenceFileTags.evidenceFileId, input.evidenceFileId),
            eq(evidenceFileTags.tagId, input.tagId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return { success: true, message: "Tag already exists on file" };
      }

      const fileTagId = `ftag_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db.insert(evidenceFileTags).values({
        id: fileTagId,
        evidenceFileId: input.evidenceFileId,
        tagId: input.tagId,
      });

      return { success: true };
    }),

  /**
   * Remove tag from evidence file
   */
  removeFromFile: protectedProcedure
    .input(
      z.object({
        evidenceFileId: z.string(),
        tagId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(evidenceFileTags)
        .where(
          and(
            eq(evidenceFileTags.evidenceFileId, input.evidenceFileId),
            eq(evidenceFileTags.tagId, input.tagId)
          )
        );

      return { success: true };
    }),

  /**
   * Get tags for a specific evidence file
   */
  getForFile: protectedProcedure
    .input(
      z.object({
        evidenceFileId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tags = await db
        .select({
          id: evidenceTags.id,
          name: evidenceTags.name,
          color: evidenceTags.color,
          createdAt: evidenceTags.createdAt,
        })
        .from(evidenceTags)
        .innerJoin(evidenceFileTags, eq(evidenceFileTags.tagId, evidenceTags.id))
        .where(
          and(
            eq(evidenceFileTags.evidenceFileId, input.evidenceFileId),
            eq(evidenceTags.userId, ctx.user.id)
          )
        );

      return tags;
    }),

  /**
   * Bulk add tags to multiple files
   */
  bulkAddToFiles: protectedProcedure
    .input(
      z.object({
        evidenceFileIds: z.array(z.string()),
        tagIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let addedCount = 0;

      for (const fileId of input.evidenceFileIds) {
        for (const tagId of input.tagIds) {
          // Check if tag already exists
          const existing = await db
            .select()
            .from(evidenceFileTags)
            .where(
              and(
                eq(evidenceFileTags.evidenceFileId, fileId),
                eq(evidenceFileTags.tagId, tagId)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            const fileTagId = `ftag_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            await db.insert(evidenceFileTags).values({
              id: fileTagId,
              evidenceFileId: fileId,
              tagId,
            });
            addedCount++;
          }
        }
      }

      return { success: true, addedCount };
    }),
});
