
import { getDb } from "./db";
import { emailAccounts } from "./schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuth2Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
  tokenType: string;
}

export interface EmailAccountInfo {
  email: string;
  displayName?: string;
  profilePicture?: string;
}

/**
 * Get OAuth2 configuration for provider
 */
export function getOAuth2Config(provider: 'gmail' | 'outlook'): OAuth2Config {
  if (provider === 'gmail') {
    return {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000'}/api/oauth/google/callback`,
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    };
  } else {
    return {
      clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
      redirectUri: `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000'}/api/oauth/outlook/callback`,
      scopes: [
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/User.Read',
      ],
    };
  }
}

/**
 * Generate OAuth2 authorization URL
 */
export function getAuthorizationUrl(provider: 'gmail' | 'outlook', userId: string): string {
  const config = getOAuth2Config(provider);
  
  // Store userId in state parameter for callback
  const state = Buffer.from(JSON.stringify({ userId, provider })).toString('base64');
  
  if (provider === 'gmail') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent to get refresh token
      state,
    });
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } else {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      response_mode: 'query',
      state,
    });
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: "gmail" | "outlook",
  code: string
): Promise<OAuth2Tokens> {
  const config = getOAuth2Config(provider);

  if (provider === "gmail") {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as Record<string, string>;
    if (!res.ok) {
      throw new Error(data.error_description || data.error || "Gmail token exchange failed");
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: Number(data.expires_in) || 3600,
      tokenType: data.token_type || "Bearer",
    };
  }

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as Record<string, string>;
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Outlook token exchange failed");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in) || 3600,
    tokenType: data.token_type || "Bearer",
  };
}

export async function getAccountInfo(
  provider: "gmail" | "outlook",
  accessToken: string
): Promise<EmailAccountInfo> {
  if (provider === "gmail") {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const d = (await r.json()) as { email?: string; name?: string; picture?: string };
    return {
      email: d.email || "",
      displayName: d.name,
      profilePicture: d.picture,
    };
  }
  const r = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const d = (await r.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return {
    email: d.mail || d.userPrincipalName || "",
    displayName: d.displayName,
  };
}

export async function saveEmailAccount(
  userId: string,
  provider: "gmail" | "outlook",
  tokens: OAuth2Tokens,
  accountInfo: EmailAccountInfo
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.email, accountInfo.email)))
    .limit(1);

  const row = {
    userId,
    provider,
    email: accountInfo.email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? null,
    metadata: JSON.stringify({
      displayName: accountInfo.displayName,
      profilePicture: accountInfo.profilePicture,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
    }),
    createdAt: new Date(),
  };

  if (existing[0]) {
    await db.update(emailAccounts).set(row).where(eq(emailAccounts.id, existing[0].id));
  } else {
    await db.insert(emailAccounts).values({ id: nanoid(), ...row });
  }
}

export async function refreshAccessToken(
  provider: "gmail" | "outlook",
  refreshToken: string
): Promise<OAuth2Tokens> {
  const config = getOAuth2Config(provider);
  if (provider === "gmail") {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as Record<string, string>;
    if (!res.ok) {
      throw new Error(data.error_description || data.error || "Gmail refresh failed");
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: Number(data.expires_in) || 3600,
      tokenType: data.token_type || "Bearer",
    };
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    scope: config.scopes.join(" "),
  });
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as Record<string, string>;
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Outlook refresh failed");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: Number(data.expires_in) || 3600,
    tokenType: data.token_type || "Bearer",
  };
}