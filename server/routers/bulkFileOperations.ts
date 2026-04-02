// @ts-nocheck

/**
 * Bulk File Operations Service
 * Handles bulk delete, tagging, and relevance scoring for evidence items
 */

import { z } from 'zod';
import { getDb } from '../db';
import { evidenceItems } from '../schema';
import { eq, inArray } from 'drizzle-orm';
import { protectedProcedure, router } from '../_core/trpc';

interface BulkDeleteResult {
  success: boolean;
  deletedCount: number;
  failedCount: number;
  errors: string[];
}

interface BulkTagResult {
  success: boolean;
  updatedCount: number;
  failedCount: number;
  errors: string[];
}

interface BulkRelevanceResult {
  success: boolean;
  updatedCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Bulk delete multiple evidence items
 */
export async function bulkDeleteItems(itemIds: string[]): Promise<BulkDeleteResult> {
  if (itemIds.length === 0) {
    return {
      success: true,
      deletedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Delete items
    const result = await db
      .delete(evidenceItems)
      .where(inArray(evidenceItems.id, itemIds));

    console.log(`[BulkFileOperations] Deleted ${itemIds.length} items`);

    return {
      success: true,
      deletedCount: itemIds.length,
      failedCount: 0,
      errors: [],
    };
  } catch (error) {
    console.error('[BulkFileOperations] Error deleting items:', error);
    return {
      success: false,
      deletedCount: 0,
      failedCount: itemIds.length,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Bulk add tags to evidence items
 */
export async function bulkAddTags(itemIds: string[], newTags: string[]): Promise<BulkTagResult> {
  if (itemIds.length === 0) {
    return {
      success: true,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get current items
    const items = await db
      .select()
      .from(evidenceItems)
      .where(inArray(evidenceItems.id, itemIds));

    let updatedCount = 0;
    const errors: string[] = [];

    // Update each item with new tags
    for (const item of items) {
      try {
        const currentTags = item.tags ? JSON.parse(item.tags) : [];
        const mergedTags = Array.from(new Set([...currentTags, ...newTags]));

        await db
          .update(evidenceItems)
          .set({
            tags: JSON.stringify(mergedTags),
            updatedAt: new Date(),
          })
          .where(eq(evidenceItems.id, item.id));

        updatedCount++;
      } catch (e) {
        errors.push(`Failed to update item ${item.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    console.log(`[BulkFileOperations] Tagged ${updatedCount} items with tags: ${newTags.join(', ')}`);

    return {
      success: errors.length === 0,
      updatedCount,
      failedCount: items.length - updatedCount,
      errors,
    };
  } catch (error) {
    console.error('[BulkFileOperations] Error tagging items:', error);
    return {
      success: false,
      updatedCount: 0,
      failedCount: itemIds.length,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Bulk remove tags from evidence items
 */
export async function bulkRemoveTags(itemIds: string[], tagsToRemove: string[]): Promise<BulkTagResult> {
  if (itemIds.length === 0) {
    return {
      success: true,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get current items
    const items = await db
      .select()
      .from(evidenceItems)
      .where(inArray(evidenceItems.id, itemIds));

    let updatedCount = 0;
    const errors: string[] = [];

    // Update each item by removing tags
    for (const item of items) {
      try {
        const currentTags = item.tags ? JSON.parse(item.tags) : [];
        const filteredTags = currentTags.filter((tag: string) => !tagsToRemove.includes(tag));

        await db
          .update(evidenceItems)
          .set({
            tags: JSON.stringify(filteredTags),
            updatedAt: new Date(),
          })
          .where(eq(evidenceItems.id, item.id));

        updatedCount++;
      } catch (e) {
        errors.push(`Failed to update item ${item.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    console.log(`[BulkFileOperations] Removed tags from ${updatedCount} items`);

    return {
      success: errors.length === 0,
      updatedCount,
      failedCount: items.length - updatedCount,
      errors,
    };
  } catch (error) {
    console.error('[BulkFileOperations] Error removing tags:', error);
    return {
      success: false,
      updatedCount: 0,
      failedCount: itemIds.length,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Bulk set relevance score for evidence items
 */
export async function bulkSetRelevanceScore(itemIds: string[], score: number): Promise<BulkRelevanceResult> {
  if (itemIds.length === 0) {
    return {
      success: true,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  // Validate score
  if (score < 0 || score > 100) {
    return {
      success: false,
      updatedCount: 0,
      failedCount: itemIds.length,
      errors: ['Relevance score must be between 0 and 100'],
    };
  }

  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Update all items with new score
    await db
      .update(evidenceItems)
      .set({
        relevanceScore: String(score),
        updatedAt: new Date(),
      })
      .where(inArray(evidenceItems.id, itemIds));

    console.log(`[BulkFileOperations] Set relevance score to ${score} for ${itemIds.length} items`);

    return {
      success: true,
      updatedCount: itemIds.length,
      failedCount: 0,
      errors: [],
    };
  } catch (error) {
    console.error('[BulkFileOperations] Error setting relevance score:', error);
    return {
      success: false,
      updatedCount: 0,
      failedCount: itemIds.length,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Bulk get items for a case (for display in UI)
 */
export async function getCaseItems(caseId: string): Promise<any[]> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const items = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.caseId, caseId));

    return items;
  } catch (error) {
    console.error('[BulkFileOperations] Error getting case items:', error);
    return [];
  }
}

function mapEvidenceRow(r: Record<string, unknown>) {
  let meta: Record<string, unknown> = {};
  if (typeof r.metadata === 'string' && r.metadata) {
    try {
      meta = JSON.parse(r.metadata) as Record<string, unknown>;
    } catch {
      meta = {};
    }
  }
  return {
    id: String(r.id),
    fileName: String(r.title ?? 'Untitled'),
    fileSize: String(meta.size ?? 0),
    itemType: String(r.source ?? 'Document'),
    relevanceScore: String(meta.relevanceScore ?? 50),
    tags: typeof meta.tags === 'string' ? meta.tags : JSON.stringify(meta.tags ?? []),
    timestamp: r.createdAt as Date,
    fileUrl: String(meta.fileUrl ?? ''),
  };
}

export const bulkFileOperationsRouter = router({
  getCaseItems: protectedProcedure
    .input(z.object({ caseId: z.coerce.string() }))
    .query(async ({ input }) => {
      const rows = await getCaseItems(input.caseId);
      return { items: rows.map((r) => mapEvidenceRow(r as Record<string, unknown>)) };
    }),

  deleteItems: protectedProcedure
    .input(z.object({ itemIds: z.array(z.string()) }))
    .mutation(async ({ input }) => bulkDeleteItems(input.itemIds)),

  addTags: protectedProcedure
    .input(z.object({ itemIds: z.array(z.string()), tags: z.array(z.string()) }))
    .mutation(async ({ input }) => bulkAddTags(input.itemIds, input.tags)),

  setRelevanceScore: protectedProcedure
    .input(z.object({ itemIds: z.array(z.string()), score: z.number() }))
    .mutation(async ({ input }) =>
      bulkSetRelevanceScore(input.itemIds, input.score)
    ),
});
