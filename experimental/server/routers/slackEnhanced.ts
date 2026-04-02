import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  getSlackAuthorizationUrl,
  listSlackChannels,
  getChannelMessages,
  syncSlackForCase,
  connectSlack,
  getSlackStatus,
  disconnectSlack,
  testSlackConnection,
} from '../slackService';
import { getDb } from '../db';
import { evidenceSources, cases } from '../schema';
import { eq, and } from 'drizzle-orm';

/**
 * Enhanced Slack Router
 * - OAuth authentication
 * - Channel listing
 * - Message sync
 * - File extraction
 */
export const slackEnhancedRouter = router({
  /**
   * Get Slack OAuth authorization URL
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

        // Get Slack OAuth URL
        const authUrl = getSlackAuthorizationUrl(ctx.user.id, input.caseId);

        return {
          success: true,
          authUrl,
        };
      } catch (error) {
        console.error('Error getting Slack OAuth URL:', error);
        throw error;
      }
    }),

  /**
   * Connect Slack using bot token (simpler approach)
   */
  connectWithBotToken: protectedProcedure
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

        // Use the bot token from environment
        const botToken = process.env.SLACK_BOT_TOKEN;
        if (!botToken) {
          throw new Error('Slack bot token not configured');
        }

        // Test the connection
        const testResult = await testSlackConnection(botToken);
        if (!testResult.ok) {
          throw new Error(`Slack connection failed: ${testResult.error}`);
        }

        // Connect Slack
        const sourceId = await connectSlack(
          ctx.user.id,
          input.caseId,
          botToken,
          testResult.teamId || '',
          testResult.team || ''
        );

        return {
          success: true,
          sourceId,
          teamName: testResult.team,
          message: `Connected to Slack workspace: ${testResult.team}`,
        };
      } catch (error) {
        console.error('Error connecting Slack:', error);
        throw error;
      }
    }),

  /**
   * Get Slack connection status for a case
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

        const status = await getSlackStatus(input.caseId);

        let metadata: { teamId?: string; teamName?: string } = {};
        if (status?.metadata) {
          try {
            metadata = JSON.parse(status.metadata);
          } catch (e) {
            // Ignore parse errors
          }
        }

        return {
          success: true,
          connected: status !== null && status.status !== 'disconnected',
          status: status ? {
            id: status.id,
            status: status.status,
            itemsCollected: status.itemsCollected,
            lastSyncedAt: status.lastSyncedAt,
            errorMessage: status.errorMessage,
            teamName: metadata.teamName,
          } : null,
        };
      } catch (error) {
        console.error('Error getting Slack status:', error);
        throw error;
      }
    }),

  /**
   * List channels in connected Slack workspace
   */
  listChannels: protectedProcedure
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

        // Get Slack connection
        const source = await db
          .select()
          .from(evidenceSources)
          .where(
            and(
              eq(evidenceSources.caseId, input.caseId),
              eq(evidenceSources.sourceType, 'Slack')
            )
          )
          .limit(1);

        if (source.length === 0) {
          throw new Error('Slack not connected');
        }

        const accessToken = source[0].accessToken;
        if (!accessToken) {
          throw new Error('No access token available');
        }

        const channels = await listSlackChannels(accessToken);

        return {
          success: true,
          channels: channels.map((c) => ({
            id: c.id,
            name: c.name,
            isPrivate: c.is_private,
            isMember: c.is_member,
            numMembers: c.num_members,
            topic: c.topic?.value,
            purpose: c.purpose?.value,
          })),
        };
      } catch (error) {
        console.error('Error listing Slack channels:', error);
        throw error;
      }
    }),

  /**
   * Get messages from a specific channel
   */
  getMessages: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        channelId: z.string(),
        limit: z.number().optional().default(100),
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

        // Get Slack connection
        const source = await db
          .select()
          .from(evidenceSources)
          .where(
            and(
              eq(evidenceSources.caseId, input.caseId),
              eq(evidenceSources.sourceType, 'Slack')
            )
          )
          .limit(1);

        if (source.length === 0) {
          throw new Error('Slack not connected');
        }

        const accessToken = source[0].accessToken;
        if (!accessToken) {
          throw new Error('No access token available');
        }

        const messages = await getChannelMessages(accessToken, input.channelId, input.limit);

        return {
          success: true,
          messages: messages.map((m) => ({
            text: m.text,
            user: m.user,
            timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
            hasFiles: !!(m.files && m.files.length > 0),
            fileCount: m.files?.length || 0,
          })),
        };
      } catch (error) {
        console.error('Error getting Slack messages:', error);
        throw error;
      }
    }),

  /**
   * Start sync of Slack messages and files
   */
  startSync: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        sourceId: z.string(),
        channelIds: z.array(z.string()).optional(),
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
          throw new Error('Slack connection not found');
        }

        const accessToken = source[0].accessToken;
        if (!accessToken) {
          throw new Error('No access token available');
        }

        // Start sync
        const progress = await syncSlackForCase(
          ctx.user.id,
          input.caseId,
          accessToken,
          input.sourceId,
          input.channelIds
        );

        return {
          success: true,
          progress,
          message: `Synced ${progress.totalMessages} messages and ${progress.totalFiles} files from ${progress.processedChannels} channels`,
        };
      } catch (error) {
        console.error('Error starting Slack sync:', error);
        throw error;
      }
    }),

  /**
   * Disconnect Slack from a case
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

        await disconnectSlack(input.sourceId);

        return {
          success: true,
          message: 'Slack disconnected successfully',
        };
      } catch (error) {
        console.error('Error disconnecting Slack:', error);
        throw error;
      }
    }),
});
