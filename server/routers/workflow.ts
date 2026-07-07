import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assertCaseOwnership } from "../_core/authz";
import { enforceRateLimit, RATE_LIMITS } from "../rateLimit";
import { createAuditLog, AUDIT_ACTIONS } from "../audit";
import { cases as casesTable } from '../schema';
import { eq } from "drizzle-orm";

export const workflowRouter = router({
  /**
   * Move a case into the "Outreach" stage.
   *
   * Phases 008/017/018/019:
   *  - protected + case-ownership (008),
   *  - idempotent: if the case is already in Outreach we do NOT re-write or
   *    re-audit, and report `alreadyInitiated` (017),
   *  - rate-limited per user (018),
   *  - audited (019).
   *
   * NOTE: this only advances the case status. It does NOT contact any lawyer —
   * the outreach draft, human-approval gate, and real send are Phase 026 and are
   * intentionally not wired here (safety boundary: no third party is contacted
   * without approval).
   */
  initiateOutreach: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await assertCaseOwnership(input.caseId, ctx.user.id);
      enforceRateLimit(ctx, "outreach", RATE_LIMITS.caseCreate);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select({ status: casesTable.status })
        .from(casesTable)
        .where(eq(casesTable.id, input.caseId))
        .limit(1);

      if (existing[0]?.status === "Outreach") {
        return { success: true, alreadyInitiated: true } as const;
      }

      await db.update(casesTable)
        .set({ status: "Outreach", updatedAt: new Date() })
        .where(eq(casesTable.id, input.caseId));

      await createAuditLog({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.OUTREACH_INITIATED,
        entityType: "case",
        entityId: input.caseId,
        details: { from: existing[0]?.status ?? null, to: "Outreach" },
      });

      return { success: true, alreadyInitiated: false } as const;
    }),
});
