import crypto from 'crypto';
import { ENV } from './_core/env';

/**
 * Token Encryption & OAuth Refresh Utilities
 */

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = Buffer.alloc(32, ENV.JWT_SECRET || 'fallback-secret-at-least-32-chars-long');
const IV_LENGTH = 16;

/**
 * Encrypt a token for storage in the database
 */
export function encryptToken(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a token retrieved from the database
 */
export function decryptToken(text: string): string {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('[emailOAuth] Token decryption failed:', error);
    return text; // Return raw if decryption fails (fallback for legacy data)
  }
}

/**
 * Refresh a Gmail access token using the refresh token
 */
export async function refreshGmailToken(refreshToken: string) {
  const clientId = ENV.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const clientSecret =
    ENV.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  if (!clientId) {
    throw new Error("Missing Google OAuth client ID configuration");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Gmail token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    expiryDate:  Date.now() + (data.expires_in * 1000),
  };
}

/**
 * Refresh an Outlook access token using the refresh token
 */
export async function refreshOutlookToken(refreshToken: string) {
  const clientId = ENV.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_OAUTH_CLIENT_ID || "";
  const clientSecret = ENV.MICROSOFT_CLIENT_SECRET || process.env.MICROSOFT_OAUTH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing Microsoft OAuth client configuration");
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
      scope:         'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Outlook token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    expiryDate:  Date.now() + (data.expires_in * 1000),
  };
}
