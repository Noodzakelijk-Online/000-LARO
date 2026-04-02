// @ts-nocheck

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  listAllOneDriveFiles,
  getAllOneDriveFolders,
  syncOneDriveForCase,
  connectOneDrive,
  getOneDriveStatus,
  disconnectOneDrive,
} from '../oneDriveService';
import { getDb } from '../db';
import { evidenceSources, cases } from '../schema';
import { eq, and } from 'drizzle-orm';
import { getAuthorizationUrl } from '../oauth2';

/**
 * Enhanced Google Drive Router
 * - Full recursive sync
 * - Connection management
 * - Status tracking
 */
export const oneDriveEnhancedRouter = router({
  /**
   * Get Google OAuth authorization URL
   * User clicks this link to authorize Google Drive access
   */
  getOAuthUrl: protectedProcedure
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

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Get Google OAuth URL
        const authUrl = getAuthorizationUrl('outlook', ctx.user.id);

        return {
          success: true,
          authUrl,
        };
      } catch (error) {
        console.error('Error getting OAuth URL:', error);
        throw error;
      }
    }),
  /**
   * Connect Google Drive to a case
   * Requires user to have already authenticated with Google OAuth
   */
  connect: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        accessToken: z.string(), // From Google OAuth
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

        // Connect Google Drive
        const sourceId = await connectOneDrive(
          ctx.user.id,
          input.caseId,
          input.accessToken
        );

        return {
          success: true,
          sourceId,
          message: 'Google Drive connected successfully',
        };
      } catch (error) {
        console.error('Error connecting Google Drive:', error);
        throw error;
      }
    }),

  /**
   * Start full sync of Google Drive files for a case
   */
  startSync: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        sourceId: z.string(),
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

        // Get the evidence source
        const source = await db
          .select()
          .from(evidenceSources)
          .where(
            and(
              eq(evidenceSources.id, input.sourceId),
              eq(evidenceSources.caseId, input.caseId)
            )
          )
          .limit(1);

        if (source.length === 0) {
          throw new Error('Google Drive connection not found');
        }

        const accessToken = source[0].accessToken;
        if (!accessToken) {
          throw new Error('No access token available');
        }

        // Start sync (in production, this should be a background job)
        const progress = await syncOneDriveForCase(
          ctx.user.id,
          input.caseId,
          accessToken,
          input.sourceId
        );

        return {
          success: true,
          progress,
          message: `Synced ${progress.extractedContent} files from Google Drive`,
        };
      } catch (error) {
        console.error('Error starting Google Drive sync:', error);
        throw error;
      }
    }),

  /**
   * Get Google Drive connection status for a case
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

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        const status = await getOneDriveStatus(input.caseId);

        return {
          success: true,
          connected: status !== null,
          status: status ? {
            id: status.id,
            status: status.status,
            itemsCollected: status.itemsCollected,
            lastSyncedAt: status.lastSyncedAt,
            errorMessage: status.errorMessage,
          } : null,
        };
      } catch (error) {
        console.error('Error getting Google Drive status:', error);
        throw error;
      }
    }),

  /**
   * List files in Google Drive (for preview before sync)
   */
  listFiles: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        folderId: z.string().optional(),
        pageToken: z.string().optional(),
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

        // Get Google Drive connection
        const source = await db
          .select()
          .from(evidenceSources)
          .where(
            and(
              eq(evidenceSources.caseId, input.caseId),
              eq(evidenceSources.sourceType, 'OneDrive')
            )
          )
          .limit(1);

        if (source.length === 0) {
          throw new Error('Google Drive not connected');
        }

        const accessToken = source[0].accessToken;
        if (!accessToken) {
          throw new Error('No access token available');
        }

        const result = await listAllOneDriveFiles(
          accessToken,
          input.folderId,
          input.pageToken
        );

        return {
          success: true,
          files: result.files.map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size,
            modifiedTime: f.modifiedTime,
          })),
          nextPageToken: result.nextPageToken,
        };
      } catch (error) {
        console.error('Error listing Google Drive files:', error);
        throw error;
      }
    }),

  /**
   * List folders in Google Drive
   */
  listFolders: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        parentFolderId: z.string().optional(),
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

        // Get Google Drive connection
        const source = await db
          .select()
          .from(evidenceSources)
          .where(
            and(
              eq(evidenceSources.caseId, input.caseId),
              eq(evidenceSources.sourceType, 'OneDrive')
            )
          )
          .limit(1);

        if (source.length === 0) {
          throw new Error('Google Drive not connected');
        }

        const accessToken = source[0].accessToken;
        if (!accessToken) {
          throw new Error('No access token available');
        }

        const result = await getAllOneDriveFolders(
          accessToken,
          input.parentFolderId || "root"
        );

        return {
          success: true,
          folders: result.map((f) => ({
            id: f.id,
            name: f.name,
          })),
        };
      } catch (error) {
        console.error('Error listing Google Drive folders:', error);
        throw error;
      }
    }),

  /**
   * Disconnect Google Drive from a case
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        sourceId: z.string(),
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

        await disconnectOneDrive(input.sourceId);

        return {
          success: true,
          message: 'Google Drive disconnected successfully',
        };
      } catch (error) {
        console.error('Error disconnecting Google Drive:', error);
        throw error;
      }
    }),
});
