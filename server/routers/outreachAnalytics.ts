/**
 * Outreach Analytics Router
 * 
 * tRPC endpoints for outreach performance analytics
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getOverallMetrics,
  getResponseRateByLawyer,
  getTimeToMatchByLegalArea,
  getMatchSuccessByRegion,
  getPerformanceTrends,
} from "./analytics";

export const outreachAnalyticsRouter = router({
  /**
   * Get overall analytics metrics
   */
  getOverallMetrics: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const startDate = input?.startDate ? new Date(input.startDate) : undefined;
      const endDate = input?.endDate ? new Date(input.endDate) : undefined;
      
      return await getOverallMetrics(startDate, endDate);
    }),

  /**
   * Get response rate by lawyer
   */
  getResponseRateByLawyer: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(20),
      }).optional()
    )
    .query(async ({ input }) => {
      return await getResponseRateByLawyer(input?.limit);
    }),

  /**
   * Get time to match by legal area
   */
  getTimeToMatchByLegalArea: publicProcedure
    .query(async () => {
      return await getTimeToMatchByLegalArea();
    }),

  /**
   * Get match success by region
   */
  getMatchSuccessByRegion: publicProcedure
    .query(async () => {
      return await getMatchSuccessByRegion();
    }),

  /**
   * Get performance trends over time
   */
  getPerformanceTrends: publicProcedure
    .input(
      z.object({
        days: z.number().optional().default(30),
      }).optional()
    )
    .query(async ({ input }) => {
      return await getPerformanceTrends(input?.days);
    }),
});
