/**
 * Cron Scheduler for LARO Outreach Automation
 * 
 * Schedules and executes automated tasks:
 * - Daily follow-up processing (Day 5, Day 10, Day 15)
 * - Lawyer statistics updates
 * - Permanent filter re-evaluation
 */

import cron from "node-cron";
import { processOutreachCron } from "./outreach-automation";

import { initializeUsageLimits } from "./usageTracking";
import { resetMonthlyAlerts } from "./usageAlerts";
import { runAutoCollectionForAllCases } from "./autoCollectionService";

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs(): void {
  console.log("[Cron] Initializing scheduled jobs...");
  
  // Initialize usage limits on startup
  initializeUsageLimits().catch((err: unknown) => {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || msg.includes("connect")) {
      console.warn(
        "[Cron] Usage limits init skipped — database unreachable. Check DATABASE_URL matches a running MySQL (e.g. mysql:3306 in Docker)."
      );
      return;
    }
    console.error("[Cron] Error initializing usage limits:", err);
  });
  

  
  // Monthly alert reset on the 1st of each month at midnight
  cron.schedule("0 0 1 * *", async () => {
    console.log("[Cron] Resetting monthly usage alerts...");
    try {
      await resetMonthlyAlerts();
      console.log("[Cron] Monthly usage alerts reset successfully");
    } catch (error) {
      console.error("[Cron] Error resetting monthly alerts:", error);
    }
  }, {
    timezone: "Europe/Amsterdam"
  });
  
  // Daily follow-up processing at 9:00 AM Amsterdam time
  // Processes Day 5, Day 10, and Day 15 follow-ups
  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Starting daily follow-up processing...");
    try {
      await processOutreachCron();
      console.log("[Cron] Daily follow-up processing completed successfully");
    } catch (error) {
      console.error("[Cron] Error in daily follow-up processing:", error);
    }
  }, {
    timezone: "Europe/Amsterdam"
  });
  
  // Hourly check for urgent follow-ups (in case something was missed)
  cron.schedule("0 * * * *", async () => {
    console.log("[Cron] Running hourly urgent follow-up check...");
    try {
      await processOutreachCron();
    } catch (error) {
      console.error("[Cron] Error in hourly follow-up check:", error);
    }
  }, {
    timezone: "Europe/Amsterdam"
  });
  
  // Weekly permanent filter re-evaluation (Sundays at 3:00 AM)
  // Re-enables lawyers who were filtered 6+ months ago
  cron.schedule("0 3 * * 0", async () => {
    console.log("[Cron] Running weekly permanent filter re-evaluation...");
    try {
      await reevaluatePermanentFilters();
      console.log("[Cron] Permanent filter re-evaluation completed");
    } catch (error) {
      console.error("[Cron] Error in permanent filter re-evaluation:", error);
    }
  }, {
    timezone: "Europe/Amsterdam"
  });
  
  // Daily evidence auto-collection at 2:00 AM Amsterdam time
  // Runs auto-collection for all cases with enabled settings
  cron.schedule("0 2 * * *", async () => {
    console.log("[Cron] Starting daily evidence auto-collection...");
    try {
      const result = await runAutoCollectionForAllCases();
      console.log(`[Cron] Auto-collection completed: ${result.casesProcessed} cases, ${result.emailsCollected} emails, ${result.filesCollected} files`);
    } catch (error) {
      console.error("[Cron] Error in evidence auto-collection:", error);
    }
  }, {
    timezone: "Europe/Amsterdam"
  });
  
  console.log("[Cron] All scheduled jobs initialized:");
  console.log("  - Daily follow-ups: 9:00 AM (Europe/Amsterdam)");
  console.log("  - Hourly urgent check: Every hour");
  console.log("  - Weekly filter re-evaluation: Sundays 3:00 AM");
  console.log("  - Daily evidence auto-collection: 2:00 AM (Europe/Amsterdam)");
}

/**
 * Re-evaluate permanently filtered lawyers
 * Unfilter lawyers whose filterUntil date has passed
 */
async function reevaluatePermanentFilters(): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const { lawyers } = await import('./schema');
    const { eq, and, lt } = await import("drizzle-orm");
    
    const db = await getDb();
    if (!db) {
      console.error("[Cron] Failed to get database connection for filter re-evaluation");
      return;
    }
    
    const now = new Date();
    
    // Find lawyers whose filter period has expired
    const expiredFilters = await db
      .select()
      .from(lawyers)
      .where(
        and(
          eq(lawyers.permanentlyFiltered, "Yes"),
          lt(lawyers.filterUntil, now)
        )
      );
    
    console.log(`[Cron] Found ${expiredFilters.length} lawyers with expired filters`);
    
    // Re-enable these lawyers
    for (const lawyer of expiredFilters) {
      await db
        .update(lawyers)
        .set({
          permanentlyFiltered: "No",
          filterUntil: null,
        })
        .where(eq(lawyers.id, lawyer.id));
      
      console.log(`[Cron] Re-enabled lawyer ${lawyer.id} (${lawyer.name}) - filter expired`);
    }
    
    console.log(`[Cron] Re-enabled ${expiredFilters.length} lawyers`);
  } catch (error) {
    console.error("[Cron] Error in reevaluatePermanentFilters:", error);
    throw error;
  }
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopCronJobs(): void {
  console.log("[Cron] Stopping all scheduled jobs...");
  cron.getTasks().forEach(task => task.stop());
  console.log("[Cron] All scheduled jobs stopped");
}

