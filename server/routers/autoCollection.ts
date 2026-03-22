import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  getAutoCollectionSettings,
  upsertAutoCollectionSettings,
  runAutoCollection,
  getAutoCollectionLogs,
  getKeywordMatches,
} from '../autoCollectionService';

export const autoCollectionRouter = router({
  /**
   * Get auto-collection settings for a case
   */
  getSettings: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const settings = await getAutoCollectionSettings(input.caseId);

        if (!settings) {
          return {
            success: false,
            settings: null,
            message: 'No auto-collection settings found',
          };
        }

        // Parse JSON fields
        const parsedSettings = {
          ...settings,
          keywords: JSON.parse(settings.keywords as string),
          emailAccountIds: JSON.parse(settings.emailAccountIds),
          googleDriveFolderIds: settings.googleDriveFolderIds
            ? JSON.parse(settings.googleDriveFolderIds)
            : [],
        };

        return {
          success: true,
          settings: parsedSettings,
        };
      } catch (error) {
        console.error('Error getting auto-collection settings:', error);
        throw error;
      }
    }),

  /**
   * Create or update auto-collection settings
   */
  upsertSettings: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        keywords: z.array(z.string()).min(1),
        keywordMatchMode: z.enum(['all', 'any']),
        dateRangeStart: z.date().optional(),
        dateRangeEnd: z.date().optional(),
        emailAccountIds: z.array(z.string()),
        googleDriveFolderIds: z.array(z.string()).optional(),
        autoDownloadAttachments: z.boolean().default(true),
        autoDownloadGoogleDriveFiles: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await upsertAutoCollectionSettings({
          caseId: input.caseId,
          userId: ctx.user.id,
          keywords: input.keywords,
          keywordMatchMode: input.keywordMatchMode,
          dateRangeStart: input.dateRangeStart,
          dateRangeEnd: input.dateRangeEnd,
          emailAccountIds: input.emailAccountIds,
          googleDriveFolderIds: input.googleDriveFolderIds,
          autoDownloadAttachments: input.autoDownloadAttachments,
          autoDownloadGoogleDriveFiles: input.autoDownloadGoogleDriveFiles,
        });

        return {
          success: true,
          message: 'Auto-collection settings saved successfully',
        };
      } catch (error) {
        console.error('Error upserting auto-collection settings:', error);
        throw error;
      }
    }),

  /**
   * Run auto-collection for a case
   */
  runCollection: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await runAutoCollection(input.caseId);

        return {
          success: true,
          result,
          message: 'Auto-collection completed',
        };
      } catch (error) {
        console.error('Error running auto-collection:', error);
        throw error;
      }
    }),

  /**
   * Get auto-collection logs for a case
   */
  getLogs: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const logs = await getAutoCollectionLogs(input.caseId, input.limit);

        return {
          success: true,
          logs,
        };
      } catch (error) {
        console.error('Error getting auto-collection logs:', error);
        throw error;
      }
    }),

  /**
   * Get keyword matches for a case
   */
  getKeywordMatches: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const matches = await getKeywordMatches(input.caseId);

        return {
          success: true,
          matches,
        };
      } catch (error) {
        console.error('Error getting keyword matches:', error);
        throw error;
      }
    }),
});
