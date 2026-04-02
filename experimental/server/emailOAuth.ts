import { OAuth2Client } from "google-auth-library";
import { ConfidentialClientApplication } from "@azure/msal-node";
import crypto from "crypto";

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const GMAIL_REDIRECT_URI =
  process.env.GMAIL_REDIRECT_URI || "http://localhost:3000/api/oauth/gmail/callback";

const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || "";
const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || "";
const OUTLOOK_REDIRECT_URI =
  process.env.OUTLOOK_REDIRECT_URI || "http://localhost:3000/api/oauth/outlook/callback";

const ENCRYPTION_KEY_RAW =
  process.env.EMAIL_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function keyBuf(): Buffer {
  return Buffer.from(ENCRYPTION_KEY_RAW.slice(0, 64), "hex");
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuf(), iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuf(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function createGmailOAuthClient(): OAuth2Client {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    throw new Error("Gmail OAuth is not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET)");
  }
  return new OAuth2Client(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
}

/** Pass-through stub — extend with token refresh using stored refresh_token when needed. */
export async function ensureValidToken<T extends { accessToken?: string | null }>(account: T): Promise<T> {
  return account;
}

export async function getGmailTokens(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
}> {
  const client = createGmailOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error("Gmail: no access_token");
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiryDate: tokens.expiry_date ?? Date.now() + 3600_000,
  };
}

export async function getGmailUserEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const d = (await r.json()) as { email?: string };
  if (!d.email) throw new Error("Could not read Gmail user email");
  return d.email;
}

export async function getOutlookTokens(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
}> {
  if (!OUTLOOK_CLIENT_ID || !OUTLOOK_CLIENT_SECRET) {
    throw new Error("Outlook OAuth is not configured");
  }
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: OUTLOOK_CLIENT_ID,
      clientSecret: OUTLOOK_CLIENT_SECRET,
      authority: "https://login.microsoftonline.com/common",
    },
  });
  const result = await cca.acquireTokenByCode({
    code,
    scopes: ["Mail.Read", "Mail.Send", "User.Read"],
    redirectUri: OUTLOOK_REDIRECT_URI,
  });
  if (!result?.accessToken) throw new Error("Outlook: no access_token");
  return {
    accessToken: result.accessToken,
    refreshToken: undefined,
    expiryDate: result.expiresOn?.getTime() ?? Date.now() + 3600_000,
  };
}

export async function getOutlookUserEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const d = (await r.json()) as { mail?: string; userPrincipalName?: string };
  const email = d.mail || d.userPrincipalName;
  if (!email) throw new Error("Could not read Outlook user email");
  return email;
}

export async function refreshGmailToken(_refreshToken: string): Promise<string> {
  void _refreshToken;
  throw new Error("refreshGmailToken not implemented — store refresh_token and use OAuth2Client.refreshAccessToken");
}

export async function refreshOutlookToken(_refreshToken: string): Promise<string> {
  void _refreshToken;
  throw new Error("refreshOutlookToken not implemented");
}
