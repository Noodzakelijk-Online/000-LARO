import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { messageTemplates, savedSearches, messages, users, cases, evidence } from "../schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const adminProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user! } });
});

export const analyticsRouter = router({

  getMessageTemplateStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const templates = await db
      .select({ id: messageTemplates.id, name: messageTemplates.name, createdAt: messageTemplates.createdAt })
      .from(messageTemplates);
    return templates.map(t => ({ ...t, category: "general", usageCount: 0 }));
  }),

  getSavedSearchStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { searches: [], byType: {}, totalSearches: 0 };
    const rows = await db
      .select({ id: savedSearches.id, name: savedSearches.name, queryJson: savedSearches.queryJson, userId: savedSearches.userId, createdAt: savedSearches.createdAt })
      .from(savedSearches)
      .orderBy(desc(savedSearches.createdAt))
      .limit(50);
    const searches = rows.map(row => {
      let searchType = "cases";
      try { const j = JSON.parse(row.queryJson ?? "{}") as any; searchType = j.searchType || "cases"; } catch {}
      return { ...row, searchType };
    });
    const byType: Record<string, number> = {};
    searches.forEach(s => { byType[s.searchType] = (byType[s.searchType] || 0) + 1; });
    return { searches, byType, totalSearches: searches.length };
  }),

  getUserEngagementStats: adminProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const days = input?.days ?? 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const [totalUsers, activeCases, totalCases, totalMessages, totalEvidence] = await Promise.all([
        db.select().from(users),
        db.select({ userId: cases.userId }).from(cases).where(gte(cases.createdAt, since)),
        db.select().from(cases).where(gte(cases.createdAt, since)),
        db.select().from(messages).where(gte(messages.createdAt, since)),
        // evidence uses createdAt not uploadedAt
        db.select().from(evidence).where(gte(evidence.createdAt, since)),
      ]);
      const activeUserIds = new Set(activeCases.map(c => c.userId));
      return {
        period: { days, since },
        users: { total: totalUsers.length, active: activeUserIds.size, activePercentage: totalUsers.length > 0 ? Math.round((activeUserIds.size / totalUsers.length) * 100) : 0 },
        cases: { total: totalCases.length, perUser: totalUsers.length > 0 ? (totalCases.length / totalUsers.length).toFixed(2) : "0" },
        messages: { total: totalMessages.length, perCase: totalCases.length > 0 ? (totalMessages.length / totalCases.length).toFixed(2) : "0" },
        evidence: { total: totalEvidence.length, perCase: totalCases.length > 0 ? (totalEvidence.length / totalCases.length).toFixed(2) : "0" },
      };
    }),

  getSystemOverview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [u, c, m, e, t, s] = await Promise.all([
      db.select().from(users), db.select().from(cases), db.select().from(messages),
      db.select().from(evidence), db.select().from(messageTemplates), db.select().from(savedSearches),
    ]);
    return { users: u.length, cases: c.length, messages: m.length, evidence: e.length, templates: t.length, savedSearches: s.length };
  }),

  getCaseStatusDistribution: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {};
    const allCases = await db.select({ status: cases.status }).from(cases);
    const distribution: Record<string, number> = {};
    allCases.forEach(c => { distribution[c.status ?? "unknown"] = (distribution[c.status ?? "unknown"] || 0) + 1; });
    return distribution;
  }),

  // Public analytics endpoints used by frontend components
  getOverallStats: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { totalCases: 0, activeCases: 0, totalEvidence: 0, totalMessages: 0 };
    const [c, e, m] = await Promise.all([db.select().from(cases), db.select().from(evidence), db.select().from(messages)]);
    return { totalCases: c.length, activeCases: c.filter(x => x.status === "active").length, totalEvidence: e.length, totalMessages: m.length };
  }),

  getOutreachTrends: publicProcedure.query(async () => ({ trends: [], total: 0 })),
  getLawyerPerformance: publicProcedure.query(async () => ({ lawyers: [] })),
  getLegalAreaDistribution: publicProcedure.query(async () => ({ areas: [] })),
  getCaseDistribution: publicProcedure.query(async () => ({ distribution: [] })),
  getLawyerCapacity: publicProcedure.query(async () => ({ capacity: [] })),
  getWorkloadMetrics: publicProcedure.query(async () => ({ metrics: [] })),
});

// Service helpers for outreachAnalytics router
export async function getOverallMetrics(startDate?: Date, endDate?: Date) {
  return { totalOutreach: 0, responseRate: 0, period: { start: startDate?.toISOString(), end: endDate?.toISOString() } };
}
export async function getResponseRateByLawyer(limit = 20) {
  return { lawyers: [] as Array<{ lawyerId: string; rate: number }>, limit };
}
export async function getTimeToMatchByLegalArea() {
  return { areas: [] as Array<{ area: string; avgHours: number }> };
}
export async function getMatchSuccessByRegion() {
  return { regions: [] as Array<{ region: string; successRate: number }> };
}
export async function getPerformanceTrends(days = 30) {
  return { days, points: [] as Array<{ date: string; value: number }> };
}