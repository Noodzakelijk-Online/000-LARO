import { getDb } from "./db";
import { emailAccounts } from "./schema";
import { and, eq } from "drizzle-orm";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function getUserEmailAccount(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function sendViaGmail(
  _accessToken: string,
  _fromEmail: string | null,
  _options: EmailOptions
): Promise<EmailResult> {
  return { success: false, error: "Gmail send not implemented in stub — use nodemailer or Gmail API." };
}

async function sendViaOutlook(
  _accessToken: string,
  _fromEmail: string | null,
  _options: EmailOptions
): Promise<EmailResult> {
  return { success: false, error: "Outlook send not implemented in stub — use Graph API." };
}

/**
 * Send email using a connected account row (access token must be usable plaintext or decrypted upstream).
 */
export async function sendEmailViaOAuth2(userId: string, options: EmailOptions): Promise<EmailResult> {
  try {
    const account = await getUserEmailAccount(userId);
    if (!account?.accessToken || !account.email) {
      return {
        success: false,
        error: "No connected email account. Connect Gmail or Outlook in Settings.",
      };
    }
    const accessToken = account.accessToken;
    if (account.provider === "gmail") {
      return await sendViaGmail(accessToken, account.email, options);
    }
    return await sendViaOutlook(accessToken, account.email, options);
  } catch (error) {
    console.error("[Email OAuth2] Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
