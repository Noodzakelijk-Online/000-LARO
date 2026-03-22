import {
  enrichLawyersBatch,
  getLawyersNeedingEnrichment,
  getEnrichmentPriority,
  type EnrichmentResult,
} from "./lawyerEnrichmentService";
import type { Lawyer } from "./schema";

/**
 * Autonomous Enrichment Scheduler (Nov 2025)
 * 
 * Automatically runs in the background to keep lawyer database up-to-date.
 * 
 * Features:
 * - Scheduled daily runs (default: 2 AM)
 * - Intelligent prioritization based on usage patterns
 * - Incremental updates (only stale data)
 * - Cost-optimized (uses cheapest LLMs)
 * - Monitoring and logging
 * - Graceful shutdown
 * 
 * Usage:
 * - Automatically starts when server starts
 * - Runs daily at configured time
 * - Can be manually triggered via API
 */

export interface EnrichmentRunConfig {
  // Schedule
  enabled: boolean;
  schedule: string; // Cron expression (default: "0 2 * * *" = 2 AM daily)

  // Batch settings
  batchSize: number; // Lawyers per batch (default: 50)
  maxConcurrency: number; // Concurrent enrichments (default: 3)
  maxLawyersPerRun: number; // Max lawyers to enrich per run (default: 500)

  // Staleness settings
  stalenessThresholdDays: number; // Consider data stale after N days (default: 30)
  skipRecentlyEnrichedDays: number; // Skip if enriched within N days (default: 7)

  // Cost controls
  maxCostPerRun: number; // Max cost in dollars per run (default: 5.00)
  stopOnBudgetExceeded: boolean; // Stop if budget exceeded (default: true)

  // Prioritization
  prioritizeByUsage: boolean; // Prioritize frequently matched lawyers (default: true)
  prioritizeByOutreach: boolean; // Prioritize lawyers with recent outreach (default: true)
}

export interface EnrichmentRunResult {
  runId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  lawyersProcessed: number;
  lawyersUpdated: number;
  fieldsEnriched: number;
  avgConfidence: number;
  totalCost: number;
  errors: number;
  status: "completed" | "partial" | "failed" | "budget_exceeded";
}

// Default configuration
const DEFAULT_CONFIG: EnrichmentRunConfig = {
  enabled: true,
  schedule: "0 2 * * *", // 2 AM daily
  batchSize: 50,
  maxConcurrency: 3,
  maxLawyersPerRun: 500,
  stalenessThresholdDays: 30,
  skipRecentlyEnrichedDays: 7,
  maxCostPerRun: 5.0,
  stopOnBudgetExceeded: true,
  prioritizeByUsage: true,
  prioritizeByOutreach: true,
};

/**
 * Get lawyers prioritized by usage patterns
 */
async function getLawyersByUsagePriority(
  limit: number,
  config: EnrichmentRunConfig
): Promise<Partial<Lawyer>[]> {
  const { getDb } = await import("./db");
  const { lawyers, outreachStatus } = await import('./schema');
  const { desc, sql, or, eq, isNull, lt } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) return [];

  // Calculate staleness date
  const stalenessDate = new Date();
  stalenessDate.setDate(
    stalenessDate.getDate() - config.stalenessThresholdDays
  );

  const skipDate = new Date();
  skipDate.setDate(skipDate.getDate() - config.skipRecentlyEnrichedDays);

  // Get lawyers with missing data or stale data
  // Prioritize by: total outreaches (usage) + missing fields
  const lawyersQuery = db
    .select({
      id: lawyers.id,
      name: lawyers.name,
      email: lawyers.email,
      phone: lawyers.phone,
      website: lawyers.website,
      firmName: lawyers.firmName,
      legalAreas: lawyers.legalAreas,
      experienceYears: lawyers.experienceYears,
      languages: lawyers.languages,
      address: lawyers.address,
      city: lawyers.city,
      novaId: lawyers.novaId,
      totalOutreaches: lawyers.totalOutreaches,
      updatedAt: lawyers.updatedAt,
    })
    .from(lawyers)
    .where(
      or(
        // Missing critical fields
        isNull(lawyers.email),
        eq(lawyers.email, ""),
        isNull(lawyers.phone),
        eq(lawyers.phone, ""),
        isNull(lawyers.website),
        eq(lawyers.website, ""),
        isNull(lawyers.legalAreas),
        eq(lawyers.legalAreas, ""),
        // Stale data
        lt(lawyers.updatedAt, stalenessDate),
        isNull(lawyers.updatedAt)
      )
    );

  // Order by usage (total outreaches) descending
  const lawyersList = await lawyersQuery
    .orderBy(desc(lawyers.totalOutreaches))
    .limit(limit * 2); // Get more for filtering

  // Filter out recently enriched
  const filtered = lawyersList.filter((lawyer) => {
    if (!lawyer.updatedAt) return true; // Never enriched
    return lawyer.updatedAt < skipDate; // Not recently enriched
  });

  // Sort by combined priority score
  const scored = filtered
    .map((lawyer) => ({
      lawyer,
      priority: getEnrichmentPriority(lawyer),
      usage: Number(lawyer.totalOutreaches) || 0,
    }))
    .sort((a, b) => {
      // Primary: priority score
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Secondary: usage
      return b.usage - a.usage;
    })
    .slice(0, limit)
    .map((item) => item.lawyer);

  return scored;
}

/**
 * Save enrichment run results to database
 */
async function saveEnrichmentRun(result: EnrichmentRunResult) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;

  // TODO: Create enrichment_runs table and save results
  // For now, just log to console
  console.log(`[Autonomous Enrichment] Run ${result.runId} completed:
    - Duration: ${(result.durationMs / 1000).toFixed(1)}s
    - Lawyers processed: ${result.lawyersProcessed}
    - Lawyers updated: ${result.lawyersUpdated}
    - Fields enriched: ${result.fieldsEnriched}
    - Avg confidence: ${result.avgConfidence}%
    - Total cost: $${result.totalCost.toFixed(4)}
    - Status: ${result.status}
  `);

  // Send notification to owner
  try {
    const { notifyOwner } = await import("./notification");
    const statusEmoji = {
      completed: "✅",
      partial: "⚠️",
      budget_exceeded: "💰",
      failed: "❌",
    }[result.status];

    await notifyOwner({
      title: `${statusEmoji} Lawyer Data Enrichment Completed`,
      content: `Enrichment run ${result.runId} finished:

**Results:**
- Lawyers processed: ${result.lawyersProcessed}
- Lawyers updated: ${result.lawyersUpdated}
- Fields enriched: ${result.fieldsEnriched}
- Average confidence: ${result.avgConfidence}%
- Total cost: $${result.totalCost.toFixed(4)}
- Duration: ${(result.durationMs / 1000).toFixed(1)}s
- Status: ${result.status}
${result.errors > 0 ? `\n⚠️ Errors: ${result.errors}` : ""}
${result.status === "budget_exceeded" ? "\n💰 Budget limit reached" : ""}`,
    });
  } catch (error) {
    console.error("[Autonomous Enrichment] Failed to send notification:", error);
  }
}

/**
 * Run a single enrichment cycle
 */
export async function runEnrichmentCycle(
  config: Partial<EnrichmentRunConfig> = {}
): Promise<EnrichmentRunResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const runId = `run_${Date.now()}`;
  const startTime = new Date();

  console.log(`[Autonomous Enrichment] Starting run ${runId}...`);

  try {
    // Get lawyers to enrich (prioritized by usage)
    const lawyersToEnrich = await getLawyersByUsagePriority(
      fullConfig.maxLawyersPerRun,
      fullConfig
    );

    if (lawyersToEnrich.length === 0) {
      console.log("[Autonomous Enrichment] No lawyers need enrichment");
      return {
        runId,
        startTime,
        endTime: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        lawyersProcessed: 0,
        lawyersUpdated: 0,
        fieldsEnriched: 0,
        avgConfidence: 0,
        totalCost: 0,
        errors: 0,
        status: "completed",
      };
    }

    console.log(
      `[Autonomous Enrichment] Enriching ${lawyersToEnrich.length} lawyers...`
    );

    // Process in batches
    let totalCost = 0;
    let totalFieldsEnriched = 0;
    let totalConfidence = 0;
    let lawyersUpdated = 0;
    let errors = 0;

    for (
      let i = 0;
      i < lawyersToEnrich.length;
      i += fullConfig.batchSize
    ) {
      // Check budget
      if (
        fullConfig.stopOnBudgetExceeded &&
        totalCost >= fullConfig.maxCostPerRun
      ) {
        console.warn(
          `[Autonomous Enrichment] Budget exceeded ($${totalCost.toFixed(4)} >= $${fullConfig.maxCostPerRun}), stopping`
        );
        
        const endTime = new Date();
        const result: EnrichmentRunResult = {
          runId,
          startTime,
          endTime,
          durationMs: endTime.getTime() - startTime.getTime(),
          lawyersProcessed: i,
          lawyersUpdated,
          fieldsEnriched: totalFieldsEnriched,
          avgConfidence:
            lawyersUpdated > 0
              ? Math.round(totalConfidence / lawyersUpdated)
              : 0,
          totalCost,
          errors,
          status: "budget_exceeded",
        };

        await saveEnrichmentRun(result);
        return result;
      }

      const batch = lawyersToEnrich.slice(i, i + fullConfig.batchSize);

      try {
        // Enrich batch
        const results = await enrichLawyersBatch(
          batch,
          fullConfig.maxConcurrency
        );

        // Update database
        const { getDb } = await import("./db");
        const { lawyers } = await import('./schema');
        const { eq } = await import("drizzle-orm");

        const db = await getDb();
        if (db) {
          for (const enrichResult of results) {
            if (Object.keys(enrichResult.enrichedFields).length > 0) {
              await db
                .update(lawyers)
                .set({
                  ...enrichResult.enrichedFields,
                  updatedAt: new Date(),
                })
                .where(eq(lawyers.id, enrichResult.lawyerId));

              lawyersUpdated++;
              totalFieldsEnriched += Object.keys(
                enrichResult.enrichedFields
              ).length;
              totalConfidence += enrichResult.confidence;
              totalCost += enrichResult.cost;
            }
          }
        }

        console.log(
          `[Autonomous Enrichment] Batch ${Math.floor(i / fullConfig.batchSize) + 1} complete (cost: $${totalCost.toFixed(4)})`
        );
      } catch (error) {
        console.error(
          `[Autonomous Enrichment] Batch ${Math.floor(i / fullConfig.batchSize) + 1} failed:`,
          error
        );
        errors++;
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const endTime = new Date();
    const result: EnrichmentRunResult = {
      runId,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      lawyersProcessed: lawyersToEnrich.length,
      lawyersUpdated,
      fieldsEnriched: totalFieldsEnriched,
      avgConfidence:
        lawyersUpdated > 0
          ? Math.round(totalConfidence / lawyersUpdated)
          : 0,
      totalCost,
      errors,
      status: errors > 0 ? "partial" : "completed",
    };

    await saveEnrichmentRun(result);
    return result;
  } catch (error) {
    console.error(`[Autonomous Enrichment] Run ${runId} failed:`, error);

    const endTime = new Date();
    const result: EnrichmentRunResult = {
      runId,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      lawyersProcessed: 0,
      lawyersUpdated: 0,
      fieldsEnriched: 0,
      avgConfidence: 0,
      totalCost: 0,
      errors: 1,
      status: "failed",
    };

    await saveEnrichmentRun(result);
    return result;
  }
}

/**
 * Autonomous Enrichment Scheduler
 * Manages scheduled enrichment runs
 */
export class AutonomousEnrichmentScheduler {
  private config: EnrichmentRunConfig;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: Partial<EnrichmentRunConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      console.log("[Autonomous Enrichment] Scheduler disabled");
      return;
    }

    console.log(
      `[Autonomous Enrichment] Scheduler started (schedule: ${this.config.schedule})`
    );

    // Parse cron expression (simplified - only supports daily at specific hour)
    // Format: "0 HOUR * * *" (e.g., "0 2 * * *" = 2 AM daily)
    const cronParts = this.config.schedule.split(" ");
    if (cronParts.length >= 2) {
      const targetHour = parseInt(cronParts[1], 10);

      // Check every hour if it's time to run
      this.intervalId = setInterval(
        () => {
          const now = new Date();
          if (now.getHours() === targetHour && !this.isRunning) {
            this.runScheduledEnrichment();
          }
        },
        60 * 60 * 1000
      ); // Check every hour

      // Also check immediately if we're at the target hour
      const now = new Date();
      if (now.getHours() === targetHour && !this.isRunning) {
        this.runScheduledEnrichment();
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log("[Autonomous Enrichment] Scheduler stopped");
  }

  /**
   * Run scheduled enrichment
   */
  private async runScheduledEnrichment(): Promise<void> {
    if (this.isRunning) {
      console.log(
        "[Autonomous Enrichment] Enrichment already running, skipping"
      );
      return;
    }

    this.isRunning = true;

    try {
      await runEnrichmentCycle(this.config);
    } catch (error) {
      console.error("[Autonomous Enrichment] Scheduled run failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger enrichment
   */
  async triggerManual(
    config?: Partial<EnrichmentRunConfig>
  ): Promise<EnrichmentRunResult> {
    const runConfig = { ...this.config, ...config };
    return runEnrichmentCycle(runConfig);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EnrichmentRunConfig>): void {
    this.config = { ...this.config, ...config };
    console.log("[Autonomous Enrichment] Configuration updated");
  }

  /**
   * Get current configuration
   */
  getConfig(): EnrichmentRunConfig {
    return { ...this.config };
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Check if enrichment is currently in progress
   */
  isEnrichmentRunning(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const autonomousScheduler = new AutonomousEnrichmentScheduler();

// Auto-start scheduler when module is loaded
// (can be disabled via config)
if (process.env.NODE_ENV === "production") {
  autonomousScheduler.start();
}
