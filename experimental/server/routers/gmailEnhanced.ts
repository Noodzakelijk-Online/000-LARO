import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  getGmailAuthorizationUrl,
  listGmailThreads,
  getGmailMessage,
  syncGmailForCase,
  testGmailConnection,
  searchGmailEmails,
} from '../gmailService';
import { getDb } from '../db';
import { evidenceSources, cases } from '../schema';
import { eq, and } from 'drizzle-orm';

/**
 * Enhanced Gmail Router
 * - OAuth authentication
 * - Email thread listing
 * - Message sync
 * - Attachment extraction
 */
export const gmailEnhancedRouter = router({
  /**
   * Get Gmail OAuth authorization URL
   */
  getOAuthUrl: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Get Gmail OAuth URL
        const authUrl = getGmailAuthorizationUrl(ctx.user.id, input.caseId);

        return {
          success: true,
          authUrl,
        };
      } catch (error) {
        console.error('Error getting Gmail OAuth URL:', error);
        throw error;
      }
    }),

  /**
   * Get Gmail connection status
   */
  getStatus: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Check if Gmail is connected
        const source = await db
          .select()
          .from(evidenceSources)
          .where(
            and(
              eq(evidenceSources.caseId, input.caseId),
              eq(evidenceSources.sourceType, 'gmail')
            )
          )
          .limit(1);

        if (source.length === 0) {
          return {
            connected: false,
            email: null,
            itemCount: 0,
            lastSyncedAt: null,
          };
        }

        return {
          connected: source[0].status === 'connected',
          email: source[0].metadata ? JSON.parse(source[0].metadata).email : null,
          itemCount: source[0].metadata ? JSON.parse(source[0].metadata).itemCount : 0,
          lastSyncedAt: source[0].metadata ? JSON.parse(source[0].metadata).lastSyncedAt : null,
        };
      } catch (error) {
        console.error('Error getting Gmail status:', error);
        throw error;
      }
    }),

  /**
   * List Gmail threads
   */
  listThreads: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        accessToken: z.string(),
        query: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // List threads
        const threads = await listGmailThreads(input.accessToken, input.query, 20);

        return {
          success: true,
          threads,
          count: threads.length,
        };
      } catch (error) {
        console.error('Error listing Gmail threads:', error);
        throw error;
      }
    }),

  /**
   * Sync Gmail threads for a case
   */
  syncThreads: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        accessToken: z.string(),
        query: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Sync threads
        const progress = await syncGmailForCase(
          ctx.user.id,
          input.caseId,
          input.accessToken,
          input.query
        );

        return {
          success: progress.errors.length === 0,
          progress,
        };
      } catch (error) {
        console.error('Error syncing Gmail threads:', error);
        throw error;
      }
    }),

  /**
   * Search Gmail emails with filters
   */
  searchEmails: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        accessToken: z.string(),
        sender: z.string().optional(),
        subject: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        maxResults: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Build filter options
        const filters = {
          sender: input.sender,
          subject: input.subject,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          maxResults: input.maxResults || 20,
        };

        // Search emails
        const threads = await searchGmailEmails(input.accessToken, filters);

        return {
          success: true,
          threads,
          count: threads.length,
          filters: {
            sender: input.sender,
            subject: input.subject,
            startDate: input.startDate,
            endDate: input.endDate,
          },
        };
      } catch (error) {
        console.error('Error searching Gmail emails:', error);
        throw error;
      }
    }),

  /**
   * Sync Gmail with filters
   */
  syncWithFilters: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        accessToken: z.string(),
        sender: z.string().optional(),
        subject: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Build filter options
        const filters = {
          sender: input.sender,
          subject: input.subject,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        };

        // Sync with filters
        const progress = await syncGmailForCase(
          ctx.user.id,
          input.caseId,
          input.accessToken,
          filters
        );

        return {
          success: progress.errors.length === 0,
          progress,
          filters: {
            sender: input.sender,
            subject: input.subject,
            startDate: input.startDate,
            endDate: input.endDate,
          },
        };
      } catch (error) {
        console.error('Error syncing Gmail with filters:', error);
        throw error;
      }
    }),

  /**
   * Disconnect Gmail
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Delete evidence source
        await db
          .delete(evidenceSources)
          .where(
            and(
              eq(evidenceSources.caseId, input.caseId),
              eq(evidenceSources.sourceType, 'gmail')
            )
          );

        return { success: true };
      } catch (error) {
        console.error('Error disconnecting Gmail:', error);
        throw error;
      }
    }),
});
