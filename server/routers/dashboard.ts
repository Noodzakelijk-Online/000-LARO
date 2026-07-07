import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { cases as casesTable, outreachStatus, emailActivity } from '../schema';
import { desc, eq, sql, and, inArray } from "drizzle-orm";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { activeCases: 0, pendingRequests: 0, resolvedCases: 0, matchingScore: 0 };

    const userId = ctx.user.id;

    const activeCases = await db.select({ count: sql<number>`count(*)` })
      .from(casesTable)
      .where(and(eq(casesTable.userId, userId), sql`status NOT IN ('Closed', 'Resolved')`));


    // Total lawyers contacted for ALL user's cases
    const lawyerContacts = await db.select({ count: sql<number>`count(*)` })
      .from(outreachStatus)
      .innerJoin(casesTable, eq(outreachStatus.caseId, casesTable.id))
      .where(eq(casesTable.userId, userId));

    const evidenceCount = await db.select({ count: sql<number>`count(*)` })
      .from(require("../schema").evidence)
      .where(eq(require("../schema").evidence.userId, userId));

    return {
      activeCases: Number(activeCases[0]?.count || 0),
      matchesMade: Number(lawyerContacts[0]?.count || 0),
      evidenceCollected: Number(evidenceCount[0]?.count || 0),
      pendingRequests: 0,
    };
  }),

  // Phase 014: computed from the user's real data instead of the previous
  // hardcoded {15, 85, 92, 78}. `change` is 0 because no historical baseline is
  // stored yet (trend deltas are a later analytics phase). Metrics we cannot
  // derive honestly are returned as 0 (= "no data yet"), not invented.
  enhancedStats: protectedProcedure.query(async ({ ctx }) => {
    const empty = {
      caseVolume: { current: 0, change: 0 },
      responseRate: { current: 0, change: 0 },
      averageMatchingScore: { current: 0, change: 0 },
      outreachEfficiency: { current: 0, change: 0 },
    };
    const db = await getDb();
    if (!db) return empty;
    const userId = ctx.user.id;

    const caseVolume = await db
      .select({ count: sql<number>`count(*)` })
      .from(casesTable)
      .where(eq(casesTable.userId, userId));

    // Outreach rows for this user's cases.
    const totalOutreach = await db
      .select({ count: sql<number>`count(*)` })
      .from(outreachStatus)
      .innerJoin(casesTable, eq(outreachStatus.caseId, casesTable.id))
      .where(eq(casesTable.userId, userId));
    const responded = await db
      .select({ count: sql<number>`count(*)` })
      .from(outreachStatus)
      .innerJoin(casesTable, eq(outreachStatus.caseId, casesTable.id))
      .where(and(eq(casesTable.userId, userId), sql`outreach_status.status IN ('Interested','Declined')`));

    const total = Number(totalOutreach[0]?.count || 0);
    const resp = Number(responded[0]?.count || 0);
    const responseRate = total > 0 ? Math.round((resp / total) * 100) : 0;

    return {
      caseVolume: { current: Number(caseVolume[0]?.count || 0), change: 0 },
      responseRate: { current: responseRate, change: 0 },
      averageMatchingScore: { current: 0, change: 0 }, // no per-case match score is persisted yet
      outreachEfficiency: { current: responseRate, change: 0 },
    };
  }),

  recentCases: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const userId = ctx.user.id;
    const results = await db.select().from(casesTable).where(eq(casesTable.userId, userId)).orderBy(desc(casesTable.createdAt)).limit(5);
    return results;
  }),

  // Phase 014: real recent-activity feed built from the user's own cases and
  // outreach email log, newest first. Previously returned two hardcoded sample
  // entries. Returns [] when there is no activity.
  activityFeed: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [] as Array<{ id: string; type: string; title: string; timestamp: Date }>;
      const userId = ctx.user.id;
      const limit = input.limit;

      const userCases = await db
        .select({ id: casesTable.id, clientName: casesTable.clientName, createdAt: casesTable.createdAt })
        .from(casesTable)
        .where(eq(casesTable.userId, userId))
        .orderBy(desc(casesTable.createdAt))
        .limit(limit);

      const feed: Array<{ id: string; type: string; title: string; timestamp: Date }> = userCases.map((c) => ({
        id: `case-${c.id}`,
        type: "case_created",
        title: `Case created for ${c.clientName ?? "client"}`,
        timestamp: (c.createdAt as Date) ?? new Date(0),
      }));

      // Recent outreach emails against this user's cases.
      const caseIds = userCases.map((c) => c.id);
      if (caseIds.length > 0) {
        const activity = await db
          .select({ id: emailActivity.id, subject: emailActivity.subject, sentAt: emailActivity.sentAt })
          .from(emailActivity)
          .where(inArray(emailActivity.caseId, caseIds))
          .orderBy(desc(emailActivity.sentAt))
          .limit(limit);
        for (const a of activity) {
          feed.push({
            id: `outreach-${a.id}`,
            type: "outreach_sent",
            title: a.subject ? `Outreach: ${a.subject}` : "Outreach recorded",
            timestamp: (a.sentAt as unknown as Date) ?? new Date(0),
          });
        }
      }

      feed.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
      return feed.slice(0, limit);
    }),

  interestedMatches: protectedProcedure.query(async ({ ctx }) => {
    const { getInterestedMatches } = await import("../db");
    const userId = ctx.user.id;
    return await getInterestedMatches(10, userId);
  }),

});


