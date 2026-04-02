// @ts-nocheck

/**
 * Case Status Router
 * 
 * API endpoints for managing case status transitions
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cases } from "../schema";
import { eq } from "drizzle-orm";
import { logError, logInfo } from "../error-handler";
import { emitCaseUpdate } from "../websocket";

const validStatuses = ["draft", "active", "pending_response", "matched", "closed"] as const;

export const caseStatusRouter = router({
  /**
   * Update case status
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        newStatus: z.enum(validStatuses),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // Get current case
        const [currentCase] = await db
          .select()
          .from(cases)
          .where(eq(cases.id, input.caseId))
          .limit(1);

        if (!currentCase) {
          throw new Error("Case not found");
        }

        // Verify ownership
        if (currentCase.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Update status
        await db
          .update(cases)
          .set({ 
            status: input.newStatus,
            updatedAt: new Date()
          })
          .where(eq(cases.id, input.caseId));

        // Emit WebSocket event
        emitCaseUpdate(currentCase.userId, {
          caseId: input.caseId,
          type: 'status_changed',
          oldStatus: currentCase.status,
          newStatus: input.newStatus,
          reason: input.reason,
        });

        logInfo("Case status updated", {
          caseId: input.caseId,
          userId: ctx.user.id,
          oldStatus: currentCase.status,
          newStatus: input.newStatus,
          reason: input.reason,
        });

        return {
          success: true,
          oldStatus: currentCase.status,
          newStatus: input.newStatus,
        };
      } catch (error) {
        logError("Failed to update case status", error as Error, {
          caseId: input.caseId,
          userId: ctx.user.id,
        });
        throw error;
      }
    }),

  /**
   * Get status history for a case
   */
  getHistory: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        return [];
      }

      try {
        // Get case to verify ownership
        const [caseData] = await db
          .select()
          .from(cases)
          .where(eq(cases.id, input.caseId))
          .limit(1);

        if (!caseData) {
          throw new Error("Case not found");
        }

        if (caseData.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // TODO: Implement status history tracking in a separate table
        // For now, return current status only
        return [
          {
            id: "1",
            caseId: input.caseId,
            status: caseData.status,
            changedAt: caseData.updatedAt || caseData.createdAt,
            changedBy: ctx.user.id,
            reason: null,
          },
        ];
      } catch (error) {
        logError("Failed to get case status history", error as Error, {
          caseId: input.caseId,
          userId: ctx.user.id,
        });
        return [];
      }
    }),

  /**
   * Get valid next statuses for a case
   */
  getValidTransitions: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        return [];
      }

      try {
        const [caseData] = await db
          .select()
          .from(cases)
          .where(eq(cases.id, input.caseId))
          .limit(1);

        if (!caseData) {
          throw new Error("Case not found");
        }

        if (caseData.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Define valid transitions
        const transitions: Record<string, string[]> = {
          draft: ["active", "closed"],
          active: ["pending_response", "closed"],
          pending_response: ["matched", "active", "closed"],
          matched: ["closed"],
          closed: [], // No transitions from closed
        };

        return transitions[caseData.status] || [];
      } catch (error) {
        logError("Failed to get valid transitions", error as Error, {
          caseId: input.caseId,
          userId: ctx.user.id,
        });
        return [];
      }
    }),
});

