import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { evidenceFiles } from "../schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export const evidenceAnalyticsRouter = router({
  /**
   * Get overall evidence statistics
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [stats] = await db
      .select({
        totalFiles: sql<number>`COUNT(*)`,
        totalSize: sql<string>`SUM(${evidenceFiles.fileSize})`,
        manualUploads: sql<number>`SUM(CASE WHEN ${evidenceFiles.uploadSource} = 'manual' THEN 1 ELSE 0 END)`,
        agentUploads: sql<number>`SUM(CASE WHEN ${evidenceFiles.uploadSource} = 'agent' THEN 1 ELSE 0 END)`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, ctx.user.id));

    return {
      totalFiles: Number(stats.totalFiles) || 0,
      totalSize: stats.totalSize || "0",
      manualUploads: Number(stats.manualUploads) || 0,
      agentUploads: Number(stats.agentUploads) || 0,
    };
  }),

  /**
   * Get file type distribution
   */
  getFileTypeDistribution: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .select({
        fileType: evidenceFiles.fileType,
        count: sql<number>`COUNT(*)`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, ctx.user.id))
      .groupBy(evidenceFiles.fileType);

    return results.map((r) => ({
      fileType: r.fileType,
      count: Number(r.count),
    }));
  }),

  /**
   * Get upload timeline (files per day)
   */
  getUploadTimeline: protectedProcedure
    .input(
      z.object({
        days: z.number().min(7).max(365).default(30),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const days = input?.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = await db
        .select({
          date: sql<string>`DATE(${evidenceFiles.uploadedAt})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(evidenceFiles)
        .where(
          and(
            eq(evidenceFiles.userId, ctx.user.id),
            gte(evidenceFiles.uploadedAt, startDate)
          )
        )
        .groupBy(sql`DATE(${evidenceFiles.uploadedAt})`)
        .orderBy(sql`DATE(${evidenceFiles.uploadedAt})`);

      return results.map((r) => ({
        date: r.date,
        count: Number(r.count),
      }));
    }),

  /**
   * Get storage usage by case
   */
  getStorageByCase: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .select({
        caseId: evidenceFiles.caseId,
        fileCount: sql<number>`COUNT(*)`,
        totalSize: sql<string>`SUM(${evidenceFiles.fileSize})`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, ctx.user.id))
      .groupBy(evidenceFiles.caseId)
      .orderBy(desc(sql`SUM(${evidenceFiles.fileSize})`))
      .limit(10);

    return results.map((r) => ({
      caseId: r.caseId,
      fileCount: Number(r.fileCount),
      totalSize: r.totalSize || "0",
    }));
  }),

  /**
   * Get upload source breakdown
   */
  getUploadSourceBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const results = await db
      .select({
        uploadSource: evidenceFiles.uploadSource,
        count: sql<number>`COUNT(*)`,
        totalSize: sql<string>`SUM(${evidenceFiles.fileSize})`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, ctx.user.id))
      .groupBy(evidenceFiles.uploadSource);

    return results.map((r) => ({
      uploadSource: r.uploadSource,
      count: Number(r.count),
      totalSize: r.totalSize || "0",
    }));
  }),

  /**
   * Get recent uploads
   */
  getRecentUploads: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const limit = input?.limit || 10;

      const results = await db
        .select()
        .from(evidenceFiles)
        .where(eq(evidenceFiles.userId, ctx.user.id))
        .orderBy(desc(evidenceFiles.uploadedAt))
        .limit(limit);

      return results;
    }),
});
