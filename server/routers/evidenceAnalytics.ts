import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { evidenceFiles } from "../schema";
import { eq, sql, desc, and } from "drizzle-orm";

export const evidenceAnalyticsRouter = router({
  getStats: publicProcedure.query(async ({ ctx }) => {
    // Default to demo user if not authenticated (common for desktop MVP)
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [stats] = await db
      .select({
        totalFiles: sql<number>`count(*)`,
        totalSize: sql<string>`sum(cast(${evidenceFiles.fileSize} as integer))`,
        manualUploads: sql<number>`count(case when ${evidenceFiles.uploadSource} = 'manual' then 1 end)`,
        agentUploads: sql<number>`count(case when ${evidenceFiles.uploadSource} = 'agent' then 1 end)`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, user.id));

    return {
      totalFiles: stats?.totalFiles || 0,
      totalSize: stats?.totalSize || "0",
      manualUploads: stats?.manualUploads || 0,
      agentUploads: stats?.agentUploads || 0,
    };
  }),

  getFileTypeDistribution: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db
      .select({
        fileType: evidenceFiles.fileType,
        count: sql<number>`count(*)`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, user.id))
      .groupBy(evidenceFiles.fileType);

    return rows.map(r => ({
      fileType: r.fileType || "unknown",
      count: r.count,
    }));
  }),

  getUploadTimeline: publicProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const user = ctx.user || { id: "demo-user-123", role: "admin" };
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const rows = await db
        .select({
          date: sql<string>`date(${evidenceFiles.uploadedAt} / 1000, 'unixepoch')`,
          count: sql<number>`count(*)`,
        })
        .from(evidenceFiles)
        .where(
          and(
            eq(evidenceFiles.userId, user.id),
            sql`${evidenceFiles.uploadedAt} >= ${startDate.getTime()}`
          )
        )
        .groupBy(sql`date(${evidenceFiles.uploadedAt} / 1000, 'unixepoch')`)
        .orderBy(sql`date(${evidenceFiles.uploadedAt} / 1000, 'unixepoch')`);

      return rows;
    }),

  getStorageByCase: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db
      .select({
        caseId: evidenceFiles.caseId,
        totalSize: sql<number>`sum(cast(${evidenceFiles.fileSize} as integer))`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, user.id))
      .groupBy(evidenceFiles.caseId)
      .orderBy(sql`sum(cast(${evidenceFiles.fileSize} as integer)) desc`)
      .limit(10);

    return rows.map(r => ({
      caseId: r.caseId || "unassigned",
      totalSize: r.totalSize || 0,
    }));
  }),

  getUploadSourceBreakdown: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db
      .select({
        uploadSource: evidenceFiles.uploadSource,
        count: sql<number>`count(*)`,
      })
      .from(evidenceFiles)
      .where(eq(evidenceFiles.userId, user.id))
      .groupBy(evidenceFiles.uploadSource);

    return rows.map(r => ({
      uploadSource: r.uploadSource || "manual",
      count: r.count,
    }));
  }),
});
