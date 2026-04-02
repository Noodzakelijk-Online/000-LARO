import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cases as casesTable, outreachStatus } from '../schema';
import { desc, eq, sql, and } from "drizzle-orm";

export const dashboardRouter = router({
  stats: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { activeCases: 0, pendingRequests: 0, resolvedCases: 0, matchingScore: 0 };

    const userId = ctx.user?.id || "demo-user-123";

    const totalCases = await db.select({ count: sql<number>`count(*)` }).from(casesTable).where(eq(casesTable.userId, userId));
    const activeCases = await db.select({ count: sql<number>`count(*)` }).from(casesTable).where(and(eq(casesTable.userId, userId), eq(casesTable.status, "Active")));

    return {
      activeCases: Number(activeCases[0]?.count || 0),
      pendingRequests: 2, // Mocked
      resolvedCases: 12, // Mocked
      matchingScore: 88, // Mocked
    };
  }),

  enhancedStats: publicProcedure.query(async () => {
    return {
      caseVolume: { current: 15, change: 10 },
      responseRate: { current: 85, change: 5 },
      averageMatchingScore: { current: 92, change: 2 },
      outreachEfficiency: { current: 78, change: -3 },
    };
  }),

  recentCases: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const userId = ctx.user?.id || "demo-user-123";
    const results = await db.select().from(casesTable).where(eq(casesTable.userId, userId)).orderBy(desc(casesTable.createdAt)).limit(5);
    return results;
  }),

  activityFeed: publicProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async () => {
      // Mocked for now
      return [
        { id: "1", type: "case_created", title: "New case created", timestamp: new Date() },
        { id: "2", type: "outreach_sent", title: "Outreach sent to Mr. Janssen", timestamp: new Date() },
      ];
    }),

  interestedMatches: publicProcedure.query(async ({ ctx }) => {
    const { getInterestedMatches } = await import("../db");
    const userId = ctx.user?.id || "demo-user-123";
    return await getInterestedMatches(10, userId);
  }),

});


