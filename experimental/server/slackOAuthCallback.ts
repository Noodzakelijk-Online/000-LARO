import { Router, Request, Response } from 'express';
import { exchangeSlackCodeForTokens, connectSlack } from './slackService';
import { getDb } from './db';
import { eq } from 'drizzle-orm';
import { users } from './schema';

const router = Router();

/**
 * Slack OAuth callback handler
 * Path: /api/oauth/slack/callback
 * 
 * This endpoint handles the OAuth2 callback from Slack after user authorization.
 * It exchanges the authorization code for access tokens and connects Slack to the user's case.
 */
router.get('/slack/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    // Handle user denial
    if (error) {
      console.log('[Slack OAuth] User denied authorization:', error);
      return res.redirect(`/?slack_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      console.error('[Slack OAuth] Missing code or state parameter');
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Decode state to get userId and caseId
    let stateData: { userId: string; caseId: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch (e) {
      console.error('[Slack OAuth] Failed to decode state:', e);
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const { userId, caseId } = stateData;

    // Verify user exists
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRecord.length === 0) {
      console.error('[Slack OAuth] User not found:', userId);
      return res.status(401).json({ error: 'User not found' });
    }

    // Exchange code for tokens
    console.log('[Slack OAuth] Exchanging code for tokens...');
    const tokenData = await exchangeSlackCodeForTokens(code);

    // Connect Slack to the case
    console.log('[Slack OAuth] Connecting Slack to case:', caseId);
    const sourceId = await connectSlack(
      userId,
      caseId,
      tokenData.accessToken,
      tokenData.teamId,
      tokenData.teamName
    );

    console.log('[Slack OAuth] Successfully connected:', sourceId);

    // Redirect back to the app with success
    // The frontend will detect the OAuth callback completion and refresh the UI
    return res.redirect(`/?slack_connected=true&sourceId=${sourceId}`);
  } catch (error) {
    console.error('[Slack OAuth] Callback failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.redirect(`/?slack_error=${encodeURIComponent(errorMessage)}`);
  }
});

export default router;
