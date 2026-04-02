import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

// Scopes for Google Drive and Gmail access
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly', // Read-only access to Google Drive
  'https://www.googleapis.com/auth/gmail.readonly', // Read-only access to Gmail
  'https://www.googleapis.com/auth/userinfo.email', // Get user email
  'https://www.googleapis.com/auth/userinfo.profile', // Get user profile
];

/**
 * Create OAuth2 client for Google authentication
 */
export function createGoogleOAuth2Client(redirectUri: string): OAuth2Client {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(redirectUri: string): string {
  const oauth2Client = createGoogleOAuth2Client(redirectUri);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}> {
  const client = createGoogleOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error("No access token from Google");
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? undefined,
  };
}