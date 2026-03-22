import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  enrichLawyerData,
  enrichLawyersBatch,
  getLawyersNeedingEnrichment,
  getEnrichmentPriority,
  type EnrichmentResult,
} from "../lawyerEnrichmentService";
import {
  autonomousScheduler,
  runEnrichmentCycle,
  type EnrichmentRunConfig,
} from "../autonomousEnrichmentScheduler";

/**
 * Lawyer Data Enrichment Router
 * 
 * Provides tRPC endpoints for:
 * - Starting enrichment jobs
 * - Monitoring progress
 * - Viewing enrichment results
 * - Managing enrichment queue
 */

export const enrichmentRouter = router({
  /**
   * Get lawyers that need enrichment, sorted by priority
   */
  getNeedingEnrichment: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input }) => {
      const lawyers = await getLawyersNeedingEnrichment(input.limit);

      return lawyers.map((lawyer) => ({
        id: lawyer.id,
        name: lawyer.name,
        city: lawyer.city,
        firmName: lawyer.firmName,
        priority: getEnrichmentPriority(lawyer),
        missingFields: {
          email: !lawyer.email || lawyer.email === "",
          phone: !lawyer.phone || lawyer.phone === "",
          website: !lawyer.website || lawyer.website === "",
          legalAreas: !lawyer.legalAreas || lawyer.legalAreas === "",
          experienceYears:
            !lawyer.experienceYears || lawyer.experienceYears === "",
          firmName: !lawyer.firmName || lawyer.firmName === "",
        },
      }));
    }),

  /**
   * Enrich a single lawyer
   */
  enrichSingle: protectedProcedure
    .input(
      z.object({
        lawyerId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const { lawyers } = await import('../schema');
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get lawyer data
      const lawyerData = await db
        .select()
        .from(lawyers)
        .where(eq(lawyers.id, input.lawyerId))
        .limit(1);

      if (lawyerData.length === 0) {
        throw new Error(`Lawyer ${input.lawyerId} not found`);
      }

      const lawyer = lawyerData[0];

      // Enrich
      const result = await enrichLawyerData(lawyer);

      // Update database if enrichment was successful
      if (Object.keys(result.enrichedFields).length > 0) {
        await db
          .update(lawyers)
          .set({
            ...result.enrichedFields,
            updatedAt: new Date(),
          })
          .where(eq(lawyers.id, input.lawyerId));
      }

      return result;
    }),

  /**
   * Start batch enrichment job
   */
  enrichBatch: protectedProcedure
    .input(
      z.object({
        lawyerIds: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(10),
        maxConcurrency: z.number().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const { lawyers } = await import('../schema');
      const { inArray } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get lawyers to enrich
      let lawyersToEnrich;

      if (input.lawyerIds && input.lawyerIds.length > 0) {
        // Enrich specific lawyers
        lawyersToEnrich = await db
          .select()
          .from(lawyers)
          .where(inArray(lawyers.id, input.lawyerIds));
      } else {
        // Enrich top priority lawyers
        lawyersToEnrich = await getLawyersNeedingEnrichment(input.limit);
      }

      if (lawyersToEnrich.length === 0) {
        return {
          success: true,
          message: "No lawyers need enrichment",
          results: [],
        };
      }

      // Run batch enrichment
      const results = await enrichLawyersBatch(
        lawyersToEnrich,
        input.maxConcurrency
      );

      // Update database with enriched data
      let updatedCount = 0;
      for (const result of results) {
        if (Object.keys(result.enrichedFields).length > 0) {
          await db
            .update(lawyers)
            .set({
              ...result.enrichedFields,
              updatedAt: new Date(),
            })
            .where(eq(lawyers.id, result.lawyerId));
          updatedCount++;
        }
      }

      // Calculate statistics
      const totalFieldsEnriched = results.reduce(
        (sum, r) => sum + Object.keys(r.enrichedFields).length,
        0
      );
      const avgConfidence =
        results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

      return {
        success: true,
        message: `Enriched ${updatedCount} lawyers`,
        stats: {
          lawyersProcessed: results.length,
          lawyersUpdated: updatedCount,
          totalFieldsEnriched,
          avgConfidence: Math.round(avgConfidence * 100),
          totalCost: totalCost.toFixed(4),
        },
        results: results.map((r) => ({
          lawyerId: r.lawyerId,
          fieldsEnriched: Object.keys(r.enrichedFields),
          confidence: Math.round(r.confidence * 100),
          sources: r.sources.length,
        })),
      };
    }),

  /**
   * Get enrichment statistics
   */
  getStats: protectedProcedure.query(async () => {
    const { getDb } = await import("../db");
    const { lawyers } = await import('../schema');
    const { count, or, eq, isNull } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) {
      return null;
    }

    // Total lawyers
    const totalResult = await db.select({ count: count() }).from(lawyers);
    const total = totalResult[0]?.count || 0;

    // Lawyers with missing email
    const missingEmailResult = await db
      .select({ count: count() })
      .from(lawyers)
      .where(or(isNull(lawyers.email), eq(lawyers.email, "")));
    const missingEmail = missingEmailResult[0]?.count || 0;

    // Lawyers with missing phone
    const missingPhoneResult = await db
      .select({ count: count() })
      .from(lawyers)
      .where(or(isNull(lawyers.phone), eq(lawyers.phone, "")));
    const missingPhone = missingPhoneResult[0]?.count || 0;

    // Lawyers with missing website
    const missingWebsiteResult = await db
      .select({ count: count() })
      .from(lawyers)
      .where(or(isNull(lawyers.website), eq(lawyers.website, "")));
    const missingWebsite = missingWebsiteResult[0]?.count || 0;

    // Lawyers with missing legal areas
    const missingLegalAreasResult = await db
      .select({ count: count() })
      .from(lawyers)
      .where(or(isNull(lawyers.legalAreas), eq(lawyers.legalAreas, "")));
    const missingLegalAreas = missingLegalAreasResult[0]?.count || 0;

    // Lawyers with missing firm name
    const missingFirmNameResult = await db
      .select({ count: count() })
      .from(lawyers)
      .where(or(isNull(lawyers.firmName), eq(lawyers.firmName, "")));
    const missingFirmName = missingFirmNameResult[0]?.count || 0;

    // Calculate completeness percentages
    const emailComplete = total > 0 ? ((total - missingEmail) / total) * 100 : 0;
    const phoneComplete = total > 0 ? ((total - missingPhone) / total) * 100 : 0;
    const websiteComplete =
      total > 0 ? ((total - missingWebsite) / total) * 100 : 0;
    const legalAreasComplete =
      total > 0 ? ((total - missingLegalAreas) / total) * 100 : 0;
    const firmNameComplete =
      total > 0 ? ((total - missingFirmName) / total) * 100 : 0;

    // Overall completeness (average of all fields)
    const overallComplete =
      (emailComplete +
        phoneComplete +
        websiteComplete +
        legalAreasComplete +
        firmNameComplete) /
      5;

    return {
      total,
      completeness: {
        overall: Math.round(overallComplete),
        email: Math.round(emailComplete),
        phone: Math.round(phoneComplete),
        website: Math.round(websiteComplete),
        legalAreas: Math.round(legalAreasComplete),
        firmName: Math.round(firmNameComplete),
      },
      missing: {
        email: missingEmail,
        phone: missingPhone,
        website: missingWebsite,
        legalAreas: missingLegalAreas,
        firmName: missingFirmName,
      },
      needsEnrichment: Math.max(
        missingEmail,
        missingPhone,
        missingWebsite,
        missingLegalAreas,
        missingFirmName
      ),
    };
  }),

  /**
   * Preview enrichment for a lawyer (without saving)
   */
  previewEnrichment: protectedProcedure
    .input(
      z.object({
        lawyerId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { lawyers } = await import('../schema');
      const { eq } = await import("drizzle-orm");

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get lawyer data
      const lawyerData = await db
        .select()
        .from(lawyers)
        .where(eq(lawyers.id, input.lawyerId))
        .limit(1);

      if (lawyerData.length === 0) {
        throw new Error(`Lawyer ${input.lawyerId} not found`);
      }

      const lawyer = lawyerData[0];

      // Run enrichment (without saving)
      const result = await enrichLawyerData(lawyer);

      return {
        current: {
          name: lawyer.name,
          email: lawyer.email,
          phone: lawyer.phone,
          website: lawyer.website,
          firmName: lawyer.firmName,
          legalAreas: lawyer.legalAreas,
          experienceYears: lawyer.experienceYears,
        },
        enriched: result.enrichedFields,
        sources: result.sources,
        confidence: Math.round(result.confidence * 100),
        cost: result.cost.toFixed(4),
      };
    }),

  /**
   * Autonomous scheduler management
   */
  scheduler: router({
    // Get scheduler status
    getStatus: protectedProcedure.query(() => {
      return {
        isRunning: autonomousScheduler.isSchedulerRunning(),
        isEnrichmentInProgress: autonomousScheduler.isEnrichmentRunning(),
        config: autonomousScheduler.getConfig(),
      };
    }),

    // Start scheduler
    start: protectedProcedure.mutation(() => {
      autonomousScheduler.start();
      return {
        success: true,
        message: "Autonomous enrichment scheduler started",
      };
    }),

    // Stop scheduler
    stop: protectedProcedure.mutation(() => {
      autonomousScheduler.stop();
      return {
        success: true,
        message: "Autonomous enrichment scheduler stopped",
      };
    }),

    // Update scheduler configuration
    updateConfig: protectedProcedure
      .input(
        z.object({
          enabled: z.boolean().optional(),
          schedule: z.string().optional(),
          batchSize: z.number().min(1).max(100).optional(),
          maxConcurrency: z.number().min(1).max(10).optional(),
          maxLawyersPerRun: z.number().min(1).max(1000).optional(),
          stalenessThresholdDays: z.number().min(1).max(365).optional(),
          skipRecentlyEnrichedDays: z.number().min(1).max(90).optional(),
          maxCostPerRun: z.number().min(0).max(100).optional(),
          stopOnBudgetExceeded: z.boolean().optional(),
          prioritizeByUsage: z.boolean().optional(),
          prioritizeByOutreach: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        autonomousScheduler.updateConfig(input);
        return {
          success: true,
          message: "Configuration updated",
          config: autonomousScheduler.getConfig(),
        };
      }),

    // Manually trigger enrichment run
    triggerManual: protectedProcedure
      .input(
        z.object({
          maxLawyersPerRun: z.number().min(1).max(100).optional(),
          maxCostPerRun: z.number().min(0).max(10).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await autonomousScheduler.triggerManual(input);
        return {
          success: true,
          message: "Manual enrichment run completed",
          result,
        };
      }),
  }),
});
