import { Router } from 'express';
import { getDb } from './db';
import { emailAccounts } from './schema';
import { eq, and } from 'drizzle-orm';
import {
  getGmailTokens,
  getOutlookTokens,
  getGmailUserEmail,
  getOutlookUserEmail,
  encryptToken,
} from './emailOAuth';
import crypto from 'crypto';

/**
 * OAuth Callback Routes for Email Integration
 * Handle OAuth redirects from Gmail and Outlook
 */

export const emailOAuthRouter = Router();

/**
 * Gmail OAuth Callback
 * GET /api/oauth/gmail/callback?code=...&state=...
 */
emailOAuthRouter.get('/gmail/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[GMAIL_OAUTH] Error from Google:', error);
    return res.send(`
      <html>
        <body>
          <h2>Gmail Connection Failed</h2>
          <p>Error: ${error}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    const tokens = await getGmailTokens(code);

    // Get user email
    const userEmail = await getGmailUserEmail(tokens.accessToken);

    // Get current user from session (simplified - in production, use proper session management)
    const userId = (req as any).user?.id; // Assumes auth middleware sets req.user

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Save to database
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Check if account already exists
    const existing = await db
      .select()
      .from(emailAccounts)
      .where(and(
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.email, userEmail)
      ))
      .limit(1);

    const accountId = existing[0]?.id || crypto.randomBytes(16).toString('hex');

    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

    const accountData = {
      id: accountId,
      userId,
      provider: 'gmail' as const,
      email: userEmail,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry: new Date(tokens.expiryDate),
      status: 'connected' as const,
      connectedAt: new Date(),
    };

    if (existing[0]) {
      await db
        .update(emailAccounts)
        .set(accountData)
        .where(eq(emailAccounts.id, accountId));
    } else {
      await db.insert(emailAccounts).values(accountData);
    }

    console.log(`[GMAIL_OAUTH] Successfully connected account: ${userEmail}`);

    // Close popup and notify parent window
    res.send(`
      <html>
        <body>
          <h2>Gmail Connected Successfully!</h2>
          <p>${userEmail}</p>
          <p>You can close this window now.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'gmail-connected', email: '${userEmail}' }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error('[GMAIL_OAUTH] Error processing callback:', error);
    res.send(`
      <html>
        <body>
          <h2>Gmail Connection Failed</h2>
          <p>Error: ${error.message}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }
});

/**
 * Outlook OAuth Callback
 * GET /api/oauth/outlook/callback?code=...&state=...
 */
emailOAuthRouter.get('/outlook/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('[OUTLOOK_OAUTH] Error from Microsoft:', error, error_description);
    return res.send(`
      <html>
        <body>
          <h2>Outlook Connection Failed</h2>
          <p>Error: ${error}</p>
          <p>${error_description || ''}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    const tokens = await getOutlookTokens(code);

    // Get user email
    const userEmail = await getOutlookUserEmail(tokens.accessToken);

    // Get current user from session
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Save to database
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Check if account already exists
    const existing = await db
      .select()
      .from(emailAccounts)
      .where(and(
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.email, userEmail)
      ))
      .limit(1);

    const accountId = existing[0]?.id || crypto.randomBytes(16).toString('hex');

    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

    const accountData = {
      id: accountId,
      userId,
      provider: 'outlook' as const,
      email: userEmail,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry: new Date(tokens.expiryDate),
      status: 'connected' as const,
      connectedAt: new Date(),
    };

    if (existing[0]) {
      await db
        .update(emailAccounts)
        .set(accountData)
        .where(eq(emailAccounts.id, accountId));
    } else {
      await db.insert(emailAccounts).values(accountData);
    }

    console.log(`[OUTLOOK_OAUTH] Successfully connected account: ${userEmail}`);

    // Close popup and notify parent window
    res.send(`
      <html>
        <body>
          <h2>Outlook Connected Successfully!</h2>
          <p>${userEmail}</p>
          <p>You can close this window now.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'outlook-connected', email: '${userEmail}' }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error('[OUTLOOK_OAUTH] Error processing callback:', error);
    res.send(`
      <html>
        <body>
          <h2>Outlook Connection Failed</h2>
          <p>Error: ${error.message}</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
  }
});

