import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { emailAccounts, evidenceSources } from '../schema';
import { eq, and } from 'drizzle-orm';
import { ENV } from '../_core/env';
import { beginOAuthFlow } from '../oauth2';

/**
 * Phase 012 — external provider reality review.
 *
 * getOAuthUrl no longer returns a blanket dummy auth URL for every provider.
 * It reports the provider's REAL availability:
 *  - Google-backed providers (Gmail, Google Drive) require GOOGLE_CLIENT_ID/SECRET.
 *  - Microsoft-backed providers (Outlook, OneDrive) require MICROSOFT_CLIENT_ID/SECRET.
 *  - Slack is not implemented.
 * When a provider is unconfigured or unsupported, the response is
 * `{ success: false, available: false, reason }` so the UI can show an honest
 * "not available / needs configuration" state instead of a broken connect button.
 */
type ProviderConfig = { configured: boolean; connectPath?: string; reason?: string };

function providerAvailability(providerName: string): ProviderConfig {
  const p = providerName.toLowerCase();
  const googleReady = !!(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET);
  const msReady = !!(ENV.MICROSOFT_CLIENT_ID && ENV.MICROSOFT_CLIENT_SECRET);
  switch (p) {
    case 'gmail':
    case 'googledrive':
      return googleReady
        ? { configured: true, connectPath: 'gmail' }
        : { configured: false, reason: 'Google OAuth is not configured (GOOGLE_CLIENT_ID/SECRET missing).' };
    case 'outlook':
    case 'onedrive':
      return msReady
        ? { configured: true, connectPath: 'outlook' }
        : { configured: false, reason: 'Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID/SECRET missing).' };
    case 'slack':
    default:
      return { configured: false, reason: `${providerName} integration is not implemented yet.` };
  }
}

const createEnhancedConnectionRouter = (providerName: string) => {
  return router({
    getStatus: protectedProcedure
      .input(z.object({ caseId: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) return { connected: false };

          const oauthProvider = providerName === 'Gmail' || providerName === 'GoogleDrive'
            ? 'gmail'
            : providerName === 'Outlook' || providerName === 'OneDrive'
              ? 'outlook'
              : null;
          if (oauthProvider) {
            const accounts = await db.select().from(emailAccounts).where(
              and(eq(emailAccounts.userId, ctx.user.id), eq(emailAccounts.provider, oauthProvider))
            ).limit(1);
            if (accounts[0]) {
              return {
                connected: accounts[0].status === 'connected',
                itemCount: 1,
                lastSync: accounts[0].connectedAt,
              };
            }
          }

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
      .mutation(async ({ ctx }) => {
        const avail = providerAvailability(providerName);
        if (!avail.configured || !avail.connectPath) {
          // Honest unavailability — no fake auth URL.
          return {
            success: false as const,
            available: false as const,
            reason: avail.reason ?? `${providerName} is not available.`,
          };
        }
        return {
          success: true as const,
          available: true as const,
          authUrl: beginOAuthFlow(avail.connectPath as 'gmail' | 'outlook', ctx.user.id),
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

export const gmailEnhancedRouter = createEnhancedConnectionRouter('Gmail');
export const outlookEnhancedRouter = createEnhancedConnectionRouter('Outlook');
export const googleDriveEnhancedRouter = createEnhancedConnectionRouter('GoogleDrive');
export const oneDriveEnhancedRouter = createEnhancedConnectionRouter('OneDrive');
export const slackEnhancedRouter = createEnhancedConnectionRouter('Slack');
