import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  getUnifiedEvidenceStats,
  getUnifiedFileTypeDistribution,
  getUnifiedUploadTimeline,
  getUnifiedStorageByCase,
  getUnifiedUploadSourceBreakdown,
} from "../evidenceUnifiedStats";

export const evidenceAnalyticsRouter = router({
  getStats: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return getUnifiedEvidenceStats(db, user.id);
  }),

  getFileTypeDistribution: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return getUnifiedFileTypeDistribution(db, user.id);
  }),

  getUploadTimeline: publicProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const user = ctx.user || { id: "demo-user-123", role: "admin" };
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      return getUnifiedUploadTimeline(db, user.id, startDate.getTime());
    }),

  getStorageByCase: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return getUnifiedStorageByCase(db, user.id, 10);
  }),

  getUploadSourceBreakdown: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.user || { id: "demo-user-123", role: "admin" };
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return getUnifiedUploadSourceBreakdown(db, user.id);
  }),
});
