/**
 * Outlook Email Service
 * Integrates with Microsoft Graph API for email access
 */

import axios from 'axios';
import { getDb } from './db';
import { emailAccounts, evidenceSources } from './schema';
import { eq, and } from 'drizzle-orm';

export interface OutlookEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  receivedDateTime: string;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  hasAttachments: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
}

export interface OutlookAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string; // Base64 encoded
}

/**
 * Get Microsoft Graph API headers with access token
 */
function getGraphHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get Outlook emails with filters
 */
export async function getOutlookEmails(
  accessToken: string,
  options?: {
    from?: string;
    subject?: string;
    before?: Date;
    after?: Date;
    hasAttachments?: boolean;
    limit?: number;
  }
): Promise<OutlookEmail[]> {
  try {
    let filter = '';
    const filters: string[] = [];

    if (options?.from) {
      filters.push(`from/emailAddress/address eq '${options.from}'`);
    }

    if (options?.subject) {
      filters.push(`contains(subject, '${options.subject}')`);
    }

    if (options?.after) {
      const isoDate = options.after.toISOString();
      filters.push(`receivedDateTime ge ${isoDate}`);
    }

    if (options?.before) {
      const isoDate = options.before.toISOString();
      filters.push(`receivedDateTime le ${isoDate}`);
    }

    if (options?.hasAttachments !== undefined) {
      filters.push(`hasAttachments eq ${options.hasAttachments}`);
    }

    if (filters.length > 0) {
      filter = `?$filter=${filters.join(' and ')}`;
    }

    const limit = options?.limit || 50;
    const separator = filter ? '&' : '?';
    const url = `https://graph.microsoft.com/v1.0/me/messages${filter}${separator}$top=${limit}`;

    const response = await axios.get(url, {
      headers: getGraphHeaders(accessToken),
    });

    return response.data.value || [];
  } catch (error) {
    console.error('[Outlook] Error fetching emails:', error);
    throw error;
  }
}

/**
 * Get specific Outlook email by ID
 */
export async function getOutlookEmail(
  accessToken: string,
  messageId: string
): Promise<OutlookEmail> {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
    const response = await axios.get(url, {
      headers: getGraphHeaders(accessToken),
    });

    return response.data;
  } catch (error) {
    console.error('[Outlook] Error fetching email:', error);
    throw error;
  }
}

/**
 * Get email attachments
 */
export async function getOutlookEmailAttachments(
  accessToken: string,
  messageId: string
): Promise<OutlookAttachment[]> {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`;
    const response = await axios.get(url, {
      headers: getGraphHeaders(accessToken),
    });

    return response.data.value || [];
  } catch (error) {
    console.error('[Outlook] Error fetching attachments:', error);
    throw error;
  }
}

/**
 * Download attachment content
 */
export async function downloadOutlookAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  try {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}`;
    const response = await axios.get(url, {
      headers: getGraphHeaders(accessToken),
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error('[Outlook] Error downloading attachment:', error);
    throw error;
  }
}

/**
 * Get user profile information
 */
export async function getOutlookUserProfile(accessToken: string) {
  try {
    const url = 'https://graph.microsoft.com/v1.0/me';
    const response = await axios.get(url, {
      headers: getGraphHeaders(accessToken),
    });

    return {
      email: response.data.userPrincipalName || response.data.mail,
      displayName: response.data.displayName,
      id: response.data.id,
    };
  } catch (error) {
    console.error('[Outlook] Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Connect Outlook account to case
 */
export async function connectOutlook(
  userId: string,
  caseId: string,
  accessToken: string,
  refreshToken?: string
): Promise<{ success: boolean; accountId: string }> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get user profile
    const profile = await getOutlookUserProfile(accessToken);

    // Store email account
    const accountId = `outlook_${Date.now()}`;
    await db.insert(emailAccounts).values({
      id: accountId,
      userId,
      provider: 'outlook',
      email: profile.email,
      displayName: profile.displayName,
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create evidence source
    await db.insert(evidenceSources).values({
      id: `source_${Date.now()}`,
      caseId,
      userId,
      sourceType: 'outlook',
      sourceIdentifier: profile.email,
      connectionStatus: 'connected',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true, accountId };
  } catch (error) {
    console.error('[Outlook] Error connecting account:', error);
    throw error;
  }
}

/**
 * Disconnect Outlook account
 */
export async function disconnectOutlook(
  userId: string,
  accountId: string
): Promise<{ success: boolean }> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Delete email account
    await db
      .delete(emailAccounts)
      .where(
        and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('[Outlook] Error disconnecting account:', error);
    throw error;
  }
}

/**
 * Sync Outlook emails for case
 */
export async function syncOutlookForCase(
  userId: string,
  caseId: string,
  accountId: string,
  options?: {
    from?: string;
    subject?: string;
    before?: Date;
    after?: Date;
    hasAttachments?: boolean;
  }
): Promise<{ emailsFound: number; attachmentsFound: number }> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get email account
    const account = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId),
          eq(emailAccounts.provider, 'outlook')
        )
      )
      .limit(1);

    if (account.length === 0) {
      throw new Error('Email account not found');
    }

    const emailAccount = account[0];

    // Fetch emails
    const emails = await getOutlookEmails(emailAccount.accessToken, {
      ...options,
      limit: 100,
    });

    let attachmentCount = 0;

    // Process each email
    for (const email of emails) {
      // Store email in evidence
      // TODO: Implement email storage in evidence system

      // Download attachments if present
      if (email.hasAttachments) {
        const attachments = await getOutlookEmailAttachments(
          emailAccount.accessToken,
          email.id
        );

        attachmentCount += attachments.length;

        // TODO: Store attachments in S3
      }
    }

    // Update sync timestamp
    await db
      .update(emailAccounts)
      .set({ updatedAt: new Date() })
      .where(eq(emailAccounts.id, accountId));

    return {
      emailsFound: emails.length,
      attachmentsFound: attachmentCount,
    };
  } catch (error) {
    console.error('[Outlook] Error syncing emails:', error);
    throw error;
  }
}

/**
 * Get Outlook connection status
 */
export async function getOutlookStatus(
  userId: string,
  accountId: string
): Promise<{
  connected: boolean;
  email?: string;
  lastSynced?: Date;
  error?: string;
}> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const account = await db
      .select()
      .from(emailAccounts)
      .where(
        and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, userId),
          eq(emailAccounts.provider, 'outlook')
        )
      )
      .limit(1);

    if (account.length === 0) {
      return { connected: false, error: 'Account not found' };
    }

    const emailAccount = account[0];

    return {
      connected: true,
      email: emailAccount.email,
      lastSynced: emailAccount.updatedAt,
    };
  } catch (error) {
    console.error('[Outlook] Error getting status:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
