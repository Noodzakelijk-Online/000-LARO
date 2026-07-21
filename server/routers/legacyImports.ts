import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { legacyImportRecords, legacyImportRuns } from "../schema";

function parseSummary(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export const legacyImportsRouter = router({
  listRuns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(legacyImportRuns)
      .where(eq(legacyImportRuns.userId, ctx.user.id))
      .orderBy(desc(legacyImportRuns.completedAt));
    return rows.map((row) => ({ ...row, summary: parseSummary(row.summary) }));
  }),

  tableCounts: protectedProcedure
    .input(z.object({ runId: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({ sourceTable: legacyImportRecords.sourceTable, count: sql<number>`count(*)` })
        .from(legacyImportRecords)
        .where(and(
          eq(legacyImportRecords.runId, input.runId),
          eq(legacyImportRecords.userId, ctx.user.id),
        ))
        .groupBy(legacyImportRecords.sourceTable)
        .orderBy(legacyImportRecords.sourceTable);
    }),
});
