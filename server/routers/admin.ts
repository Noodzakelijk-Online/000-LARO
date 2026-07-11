import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getJobStatus } from "../cronScheduler";
import { ENV } from "../_core/env";

/**
 * Phase 036 — admin/operator diagnostics.
 *
 * Gated by `adminProcedure` (role === 'admin'; the OWNER_ID account is admin).
 * Exposes operational internals WITHOUT leaking any secret values — only
 * booleans for whether each integration is configured.
 */
export const adminRouter = router({
  diagnostics: adminProcedure.query(async () => {
    let dbReady = false;
    try {
      dbReady = !!(await getDb());
    } catch {
      dbReady = false;
    }
    return {
      system: {
        node: process.version,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
        env: ENV.NODE_ENV,
        isProduction: ENV.isProd,
        demoMode: ENV.isDemo,
      },
      db: { ready: dbReady },
      jobs: getJobStatus(),
      integrations: {
        ai: !!(ENV.OPENAI_API_KEY || ENV.ANTHROPIC_API_KEY || ENV.GOOGLE_GEMINI_API_KEY || ENV.forgeApiKey),
        s3: !!ENV.AWS_S3_BUCKET,
        google: !!(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET),
        microsoft: !!(ENV.MICROSOFT_CLIENT_ID && ENV.MICROSOFT_CLIENT_SECRET),
        email: !!(ENV.SENDGRID_API_KEY || ENV.AWS_SES_ACCESS_KEY),
      },
    };
  }),

  // Row counts per table (operator visibility into data volume).
  tableCounts: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {} as Record<string, number>;
    const sqlite: any = (db as any).$client ?? (db as any).session?.client;
    if (!sqlite) return {} as Record<string, number>;

    const tables = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    ).filter((t) => !t.name.startsWith("sqlite_") && !t.name.startsWith("__"));
    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const row = sqlite.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get() as { c: number };
        counts[t.name] = row.c;
      } catch {
        /* skip unreadable tables */
      }
    }
    return counts;
  }),

  // Phase 061 — data invariant verification (read-only).
  invariants: adminProcedure.query(async () => {
    const { verifyInvariants } = await import("../invariants");
    return verifyInvariants();
  }),

  // Phase 054 — data reconciliation report (read-only) + repair (admin only).
  reconcileReport: adminProcedure.query(async () => {
    const { reconcileReport } = await import("../reconcile");
    return reconcileReport();
  }),
  repairOrphans: adminProcedure.mutation(async () => {
    const { repairOrphans } = await import("../reconcile");
    return repairOrphans();
  }),
});
