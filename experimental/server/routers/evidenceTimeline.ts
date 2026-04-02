import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { evidence } from '../schema';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';

/**
 * Evidence Timeline Router
 * 
 * Provides timeline view of evidence collection across cases
 */

export const evidenceTimelineRouter = router({
  /**
   * Get evidence timeline with filters
   */
  getTimeline: protectedProcedure
    .input(z.object({
      caseId: z.string().optional(),
      source: z.string().optional(),
      type: z.enum(['document', 'email', 'chat', 'photo', 'video', 'audio', 'other']).optional(),
      search: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      // Build conditions
      const conditions = [
        eq(evidence.userId, ctx.user.id),
      ];

      if (input.caseId) {
        conditions.push(eq(evidence.caseId, input.caseId));
      }

      if (input.source) {
        conditions.push(eq(evidence.source, input.source));
      }

      if (input.type) {
        conditions.push(eq(evidence.type, input.type));
      }

      if (input.search) {
        conditions.push(
          or(
            like(evidence.title, `%${input.search}%`),
            like(evidence.description, `%${input.search}%`),
            like(evidence.tags, `%${input.search}%`)
          )!
        );
      }

      if (input.startDate) {
        conditions.push(sql`${evidence.createdAt} >= ${new Date(input.startDate)}`);
      }

      if (input.endDate) {
        conditions.push(sql`${evidence.createdAt} <= ${new Date(input.endDate)}`);
      }

      // Fetch evidence
      const items = await db
        .select()
        .from(evidence)
        .where(and(...conditions))
        .orderBy(desc(evidence.createdAt))
        .limit(500);

      return items;
    }),

  /**
   * Get timeline statistics
   */
  getStats: protectedProcedure
    .input(z.object({
      caseId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;

      const conditions = [eq(evidence.userId, ctx.user.id)];
      if (input.caseId) {
        conditions.push(eq(evidence.caseId, input.caseId));
      }

      const items = await db
        .select()
        .from(evidence)
        .where(and(...conditions));

      // Calculate stats
      const byType = items.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const bySource = items.reduce((acc, item) => {
        const source = item.source || 'Unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalSize = items.reduce((sum, item) => {
        return sum + (parseInt(item.fileSize || '0') || 0);
      }, 0);

      return {
        total: items.length,
        byType,
        bySource,
        totalSize,
        oldestDate: items.length > 0 ? items[items.length - 1].createdAt : null,
        newestDate: items.length > 0 ? items[0].createdAt : null,
      };
    }),
});
