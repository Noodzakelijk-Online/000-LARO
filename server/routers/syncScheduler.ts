/**
 * Sync Scheduler Service
 * Manages background jobs for automatic evidence collection from connected sources
 * Supports scheduling auto-sync for Gmail, Google Drive, OneDrive, Slack, and Trello
 */

import { z } from 'zod';
import { getDb } from '../db';
import { evidenceSources, cases } from '../schema';
import { protectedProcedure, router } from '../_core/trpc';
import { eq, and } from 'drizzle-orm';
import { syncGmailForCase } from '../gmailService';
import { syncGoogleDriveForCase } from '../googleDriveServiceEnhanced';

interface SyncJob {
  sourceId: string;
  caseId: string;
  sourceType: 'gmail' | 'google_drive' | 'onedrive' | 'slack' | 'trello';
  accessToken: string;
  userId: string;
  lastSyncedAt?: Date;
  nextSyncAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface SyncScheduleConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly'; // hourly = every hour, daily = every day at 2 AM, weekly = every Sunday at 2 AM
  maxConcurrentJobs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

// In-memory job queue
const jobQueue: SyncJob[] = [];
let isProcessing = false;

/**
 * Get default sync schedule configuration
 */
export function getDefaultSyncConfig(): SyncScheduleConfig {
  return {
    enabled: true,
    frequency: 'daily',
    maxConcurrentJobs: 3,
    retryAttempts: 3,
    retryDelayMs: 5000,
  };
}

/**
 * Get all pending sync jobs
 */
export async function getPendingSyncJobs(): Promise<SyncJob[]> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get all connected evidence sources
    const sources = await db
      .select()
      .from(evidenceSources)
      .where(eq(evidenceSources.status, 'connected'));

    const jobs: SyncJob[] = [];

    for (const source of sources) {
      if (!source.metadata) continue;

      try {
        const metadata = JSON.parse(source.metadata);
        const accessToken = metadata.accessToken;

        if (!accessToken) continue;

        jobs.push({
          sourceId: source.id,
          caseId: source.caseId,
          sourceType: source.sourceType as any,
          accessToken,
          userId: source.userId,
          lastSyncedAt: source.lastSyncedAt || undefined,
          status: 'pending',
        });
      } catch (e) {
        console.error(`Failed to parse metadata for source ${source.id}:`, e);
      }
    }

    return jobs;
  } catch (error) {
    console.error('Error getting pending sync jobs:', error);
    return [];
  }
}

/**
 * Process a single sync job
 */
async function processSyncJob(job: SyncJob): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[SyncScheduler] Processing ${job.sourceType} sync for case ${job.caseId}`);

    let result;

    switch (job.sourceType) {
      case 'gmail':
        result = await syncGmailForCase(job.userId, job.caseId, job.accessToken);
        break;

      case 'google_drive':
        result = await syncGoogleDriveForCase(job.userId, job.caseId, job.accessToken);
        break;

      case 'onedrive':
        // TODO: Implement OneDrive sync
        console.log(`[SyncScheduler] OneDrive sync not yet implemented`);
        return { success: false, error: 'OneDrive sync not implemented' };

      case 'slack':
        // TODO: Implement Slack sync
        console.log(`[SyncScheduler] Slack sync not yet implemented`);
        return { success: false, error: 'Slack sync not implemented' };

      case 'trello':
        // TODO: Implement Trello sync
        console.log(`[SyncScheduler] Trello sync not yet implemented`);
        return { success: false, error: 'Trello sync not implemented' };

      default:
        return { success: false, error: `Unknown source type: ${job.sourceType}` };
    }

    // Update last synced time
    const db = await getDb();
    if (db) {
      await db
        .update(evidenceSources)
        .set({
          lastSyncedAt: new Date(),
        })
        .where(eq(evidenceSources.id, job.sourceId));
    }

    console.log(`[SyncScheduler] Successfully synced ${job.sourceType} for case ${job.caseId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[SyncScheduler] Error processing sync job:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Process all pending sync jobs
 */
export async function processPendingSyncJobs(config: SyncScheduleConfig = getDefaultSyncConfig()): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  if (isProcessing) {
    console.log('[SyncScheduler] Already processing jobs, skipping');
    return { processed: 0, succeeded: 0, failed: 0, errors: ['Already processing'] };
  }

  isProcessing = true;
  const results = { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] };

  try {
    const jobs = await getPendingSyncJobs();
    console.log(`[SyncScheduler] Found ${jobs.length} pending sync jobs`);

    // Process jobs with concurrency limit
    for (let i = 0; i < jobs.length; i += config.maxConcurrentJobs) {
      const batch = jobs.slice(i, i + config.maxConcurrentJobs);
      const batchResults = await Promise.all(batch.map(job => processSyncJob(job)));

      for (const result of batchResults) {
        results.processed++;
        if (result.success) {
          results.succeeded++;
        } else {
          results.failed++;
          if (result.error) {
            results.errors.push(result.error);
          }
        }
      }
    }

    console.log(
      `[SyncScheduler] Completed: ${results.processed} processed, ${results.succeeded} succeeded, ${results.failed} failed`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[SyncScheduler] Error processing sync jobs:', errorMsg);
    results.errors.push(errorMsg);
  } finally {
    isProcessing = false;
  }

  return results;
}

/**
 * Get sync status for a specific case
 */
export async function getCaseSyncStatus(caseId: string): Promise<{
  sources: Array<{
    sourceType: string;
    status: string;
    lastSyncedAt?: Date;
    itemCount: number;
  }>;
}> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const sources = await db
      .select()
      .from(evidenceSources)
      .where(eq(evidenceSources.caseId, caseId));

    return {
      sources: sources.map(s => ({
        sourceType: s.sourceType,
        status: s.status,
        lastSyncedAt: s.lastSyncedAt || undefined,
        itemCount: s.itemCount || 0,
      })),
    };
  } catch (error) {
    console.error('Error getting case sync status:', error);
    return { sources: [] };
  }
}

/**
 * Enable auto-sync for a case source
 */
export async function enableAutoSync(caseId: string, sourceType: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    await db
      .update(evidenceSources)
      .set({
        metadata: JSON.stringify({
          autoSyncEnabled: true,
          lastAutoSyncAt: new Date().toISOString(),
        }),
      })
      .where(and(eq(evidenceSources.caseId, caseId), eq(evidenceSources.sourceType, sourceType)));

    console.log(`[SyncScheduler] Enabled auto-sync for ${sourceType} in case ${caseId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error enabling auto-sync:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Disable auto-sync for a case source
 */
export async function disableAutoSync(caseId: string, sourceType: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    await db
      .update(evidenceSources)
      .set({
        metadata: JSON.stringify({
          autoSyncEnabled: false,
        }),
      })
      .where(and(eq(evidenceSources.caseId, caseId), eq(evidenceSources.sourceType, sourceType)));

    console.log(`[SyncScheduler] Disabled auto-sync for ${sourceType} in case ${caseId}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error disabling auto-sync:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get auto-sync status for a case source
 */
export async function getAutoSyncStatus(caseId: string, sourceType: string): Promise<{
  enabled: boolean;
  lastSyncAt?: Date;
}> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const source = await db
      .select()
      .from(evidenceSources)
      .where(and(eq(evidenceSources.caseId, caseId), eq(evidenceSources.sourceType, sourceType)))
      .limit(1);

    if (source.length === 0) {
      return { enabled: false };
    }

    const metadata = source[0].metadata ? JSON.parse(source[0].metadata) : {};

    return {
      enabled: metadata.autoSyncEnabled || false,
      lastSyncAt: source[0].lastSyncedAt || undefined,
    };
  } catch (error) {
    console.error('Error getting auto-sync status:', error);
    return { enabled: false };
  }
}

export const syncSchedulerRouter = router({
  enableAutoSync: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        sourceType: z.string(),
      })
    )
    .mutation(async ({ input }) => enableAutoSync(input.caseId, input.sourceType)),

  disableAutoSync: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        sourceType: z.string(),
      })
    )
    .mutation(async ({ input }) => disableAutoSync(input.caseId, input.sourceType)),

  getAutoSyncStatus: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        sourceType: z.string(),
      })
    )
    .query(async ({ input }) => getAutoSyncStatus(input.caseId, input.sourceType)),
});
