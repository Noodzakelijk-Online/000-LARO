/**
 * Phase 054 — data reconciliation and repair.
 *
 * Detects and (optionally) repairs data-integrity problems that can accumulate
 * from installed databases that predate native foreign keys and compatibility
 * relationship triggers:
 *   - orphaned child rows (caseId / userId pointing at a missing parent),
 *   - duplicate users by email.
 *
 * `reconcileReport()` is read-only (safe to run anytime). `repairOrphans()`
 * deletes orphaned rows inside a transaction and returns the counts.
 */
import { getDb } from "./db";
import { requiredRelationships } from "./relationshipIntegrity";

function rawClient(db: any): any {
  return db?.$client ?? db?.session?.client ?? null;
}

export interface ReconcileReport {
  orphanedByCaseId: Record<string, number>;
  orphanedByUserId: Record<string, number>;
  orphanedByRelationship: Record<string, number>;
  duplicateEmails: Array<{ email: string; count: number }>;
  totalOrphans: number;
}

export async function reconcileReport(): Promise<ReconcileReport> {
  const db = await getDb();
  const sqlite = rawClient(db);
  const report: ReconcileReport = {
    orphanedByCaseId: {},
    orphanedByUserId: {},
    orphanedByRelationship: {},
    duplicateEmails: [],
    totalOrphans: 0,
  };
  if (!sqlite) return report;

  for (const relationship of requiredRelationships(sqlite)) {
    const { childTable, childColumn, parentTable, parentColumn } = relationship;
    try {
      const n = Number((sqlite.prepare(
        `SELECT count(*) AS c
         FROM "${childTable}" child
         WHERE child."${childColumn}" IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM "${parentTable}" parent
             WHERE parent."${parentColumn}" = child."${childColumn}"
           )`
      ).get() as any).c || 0);
      if (n === 0) continue;

      const key = `${childTable}.${childColumn}->${parentTable}.${parentColumn}`;
      report.orphanedByRelationship[key] = n;
      report.totalOrphans += n;
      if (childColumn === "caseId" && parentTable === "cases") report.orphanedByCaseId[childTable] = n;
      if (childColumn === "userId" && parentTable === "users") report.orphanedByUserId[childTable] = n;
    } catch { /* skip compatibility tables that cannot be queried */ }
  }

  try {
    const dups = sqlite.prepare(
      `SELECT email, count(*) AS c FROM users WHERE email IS NOT NULL GROUP BY email HAVING c > 1`
    ).all() as Array<{ email: string; c: number }>;
    report.duplicateEmails = dups.map((d) => ({ email: d.email, count: d.c }));
  } catch { /* skip */ }

  return report;
}

export async function repairOrphans(): Promise<{ deleted: Record<string, number> }> {
  const db = await getDb();
  const sqlite = rawClient(db);
  if (!sqlite) return { deleted: {} };

  const deleted: Record<string, number> = {};
  const tx = sqlite.transaction(() => {
    for (const relationship of requiredRelationships(sqlite)) {
      const { childTable, childColumn, parentTable, parentColumn } = relationship;
      try {
        const info = sqlite.prepare(
          `DELETE FROM "${childTable}"
           WHERE "${childColumn}" IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM "${parentTable}" parent
               WHERE parent."${parentColumn}" = "${childTable}"."${childColumn}"
             )`
        ).run();
        if (info.changes) deleted[`${childTable}.${childColumn}`] = info.changes;
      } catch { /* skip compatibility tables that cannot be queried */ }
    }
  });
  tx();
  return { deleted };
}
