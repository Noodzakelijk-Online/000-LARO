import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { evidenceSources } from '../schema';
import { eq, and } from 'drizzle-orm';

const createDummyEnhancedRouter = (providerName: string) => {
  return router({
    getStatus: protectedProcedure
      .input(z.object({ caseId: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) return { connected: false };

          const conditions = [
            eq(evidenceSources.userId, ctx.user.id),
            eq(evidenceSources.sourceType, providerName)
          ];
          if (input?.caseId) conditions.push(eq(evidenceSources.caseId, input.caseId));

          const sources = await db.select().from(evidenceSources).where(and(...conditions)).limit(1);
          if (sources.length === 0) return { connected: false };

          const source = sources[0];
          const metadata = source.metadata ? JSON.parse(source.metadata) : {};
          return {
            connected: source.status === 'connected',
            itemCount: source.itemCount || 0,
            lastSync: source.lastSyncedAt,
          };
        } catch (error) {
          return { connected: false };
        }
      }),

    getOAuthUrl: protectedProcedure
      .mutation(async () => {
        // Return a dummy auth URL for now to prevent breaking the frontend
        return {
          success: true,
          authUrl: `/api/oauth/${providerName.toLowerCase()}/connect`,
        };
      }),

    disconnect: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          const db = await getDb();
          if (db) {
            await db.delete(evidenceSources).where(
              and(
                eq(evidenceSources.userId, ctx.user.id),
                eq(evidenceSources.sourceType, providerName)
              )
            );
          }
          return { success: true };
        } catch (error) {
          throw new Error(`Failed to disconnect ${providerName}`);
        }
      }),
  });
};

export const gmailEnhancedRouter = createDummyEnhancedRouter('Gmail');
export const outlookEnhancedRouter = createDummyEnhancedRouter('Outlook');
export const googleDriveEnhancedRouter = createDummyEnhancedRouter('GoogleDrive');
export const oneDriveEnhancedRouter = createDummyEnhancedRouter('OneDrive');
export const slackEnhancedRouter = createDummyEnhancedRouter('Slack');
