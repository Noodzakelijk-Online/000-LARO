import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  scoreEvidenceRelevance,
  scoreAllEvidenceForCase,
  batchScoreEvidence,
  getRelevanceStatistics,
  rescoreEvidenceItem,
} from "../relevanceScoringService";
import { TRPCError } from "@trpc/server";

const caseContextSchema = z.object({
  caseId: z.string().min(1),
  description: z.string().min(1),
  legalArea: z.string().min(1),
  keyIssues: z.array(z.string()).min(1),
});

export const relevanceScoringRouter = router({
  /**
   * Score a single evidence item
   */
  scoreItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        caseContext: caseContextSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await scoreEvidenceRelevance(
          input.itemId,
          input.title,
          input.description,
          input.caseContext
        );

        return {
          success: true,
          result,
          message: "Evidence item scored successfully",
        };
      } catch (error) {
        console.error("[Relevance Scoring Router] Error scoring item:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to score evidence item",
        });
      }
    }),

  /**
   * Score all evidence for a case
   */
  scoreAllForCase: protectedProcedure
    .input(
      z.object({
        caseContext: caseContextSchema,
        limit: z.number().optional().default(100),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const results = await scoreAllEvidenceForCase(input.caseContext.caseId, input.caseContext, {
          limit: input.limit,
        });

        return {
          success: true,
          results,
          totalScored: results.length,
          message: `Successfully scored ${results.length} evidence items`,
        };
      } catch (error) {
        console.error("[Relevance Scoring Router] Error scoring all evidence:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to score all evidence",
        });
      }
    }),

  /**
   * Batch score evidence with progress tracking
   */
  batchScore: protectedProcedure
    .input(
      z.object({
        caseContext: caseContextSchema,
        batchSize: z.number().optional().default(10),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const results = await batchScoreEvidence(input.caseContext.caseId, input.caseContext, {
          batchSize: input.batchSize,
        });

        return {
          success: true,
          results,
          totalScored: results.length,
          message: `Successfully batch scored ${results.length} evidence items`,
        };
      } catch (error) {
        console.error("[Relevance Scoring Router] Error batch scoring:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to batch score evidence",
        });
      }
    }),

  /**
   * Get relevance statistics for a case
   */
  getStatistics: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      try {
        const stats = await getRelevanceStatistics(input.caseId);

        return {
          success: true,
          statistics: stats,
          message: "Relevance statistics retrieved successfully",
        };
      } catch (error) {
        console.error("[Relevance Scoring Router] Error getting statistics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get relevance statistics",
        });
      }
    }),

  /**
   * Rescore a single evidence item
   */
  rescoreItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string().min(1),
        caseContext: caseContextSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await rescoreEvidenceItem(input.itemId, input.caseContext);

        return {
          success: true,
          result,
          message: "Evidence item rescored successfully",
        };
      } catch (error) {
        console.error("[Relevance Scoring Router] Error rescoring item:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to rescore evidence item",
        });
      }
    }),

  /**
   * Get scoring recommendations
   */
  getRecommendations: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      try {
        const stats = await getRelevanceStatistics(input.caseId);

        const recommendations = [];

        if (stats.totalScored === 0) {
          recommendations.push({
            priority: "high",
            message: "No evidence has been scored yet. Run batch scoring to analyze all evidence.",
            action: "batchScore",
          });
        }

        if (stats.lowRelevance > stats.highRelevance * 2) {
          recommendations.push({
            priority: "medium",
            message:
              "Many evidence items have low relevance scores. Consider refining your case context.",
            action: "refineContext",
          });
        }

        if (stats.averageScore < 50) {
          recommendations.push({
            priority: "high",
            message: "Average relevance score is low. Review case description and key issues.",
            action: "reviewContext",
          });
        }

        return {
          success: true,
          recommendations,
          statistics: stats,
        };
      } catch (error) {
        console.error("[Relevance Scoring Router] Error getting recommendations:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get recommendations",
        });
      }
    }),
});
