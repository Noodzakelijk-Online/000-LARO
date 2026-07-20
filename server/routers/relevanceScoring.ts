import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { AUDIT_ACTIONS, createAuditLog } from "../audit";
import {
  getEvidenceRelevanceStatistics,
  scoreAllEvidenceForCase,
} from "../relevanceScoring";

const caseContextSchema = z.object({
  caseId: z.string().min(1),
  description: z.string().optional(),
  legalArea: z.string().optional(),
  keyIssues: z.array(z.string()).optional(),
});

export const relevanceScoringRouter = router({
  getStatistics: protectedProcedure
    .input(z.object({ caseId: z.string().min(1) }))
    .query(async ({ input, ctx }) => ({
      success: true as const,
      statistics: await getEvidenceRelevanceStatistics(ctx.user.id, input.caseId),
    })),

  getRecommendations: protectedProcedure
    .input(z.object({ caseId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const statistics = await getEvidenceRelevanceStatistics(ctx.user.id, input.caseId);
      const recommendations: Array<{ priority: "high" | "medium"; message: string; action: string }> = [];
      if (statistics.totalEvidence === 0) {
        recommendations.push({ priority: "high", message: "Collect evidence before running relevance scoring.", action: "collectEvidence" });
      } else if (statistics.totalScored === 0) {
        recommendations.push({ priority: "high", message: "Run case-grounded scoring for the current evidence set.", action: "batchScore" });
      }
      if (statistics.analyzedEvidence < statistics.totalEvidence) {
        recommendations.push({
          priority: "medium",
          message: `${statistics.totalEvidence - statistics.analyzedEvidence} evidence item(s) have no document analysis yet; their score uses metadata only.`,
          action: "analyzeDocuments",
        });
      }
      if (statistics.totalScored > 0 && statistics.lowRelevance > statistics.highRelevance * 2) {
        recommendations.push({
          priority: "medium",
          message: "Most scored evidence has low case overlap. Review the case summary and low-scoring items.",
          action: "reviewContext",
        });
      }
      return { success: true as const, recommendations, statistics };
    }),

  batchScore: protectedProcedure
    .input(z.object({
      caseContext: caseContextSchema,
      batchSize: z.number().int().min(1).max(50).default(10),
    }))
    .mutation(async ({ input, ctx }) => {
      const results = await scoreAllEvidenceForCase({
        userId: ctx.user.id,
        caseId: input.caseContext.caseId,
        batchSize: input.batchSize,
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.EVIDENCE_SCORED,
        entityType: "case",
        entityId: input.caseContext.caseId,
        details: { items: results.length, method: "case-context-v1" },
      });
      return {
        success: true as const,
        results,
        totalScored: results.length,
      };
    }),
});
