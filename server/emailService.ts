import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import { createGmailOAuthClient, decryptToken, ensureValidToken } from './emailOAuth';
import { storagePut } from './storage';
import crypto from 'crypto';

/**
 * Email Fetching Service
 * Fetches emails from Gmail and Outlook/Microsoft Graph
 */

export interface EmailFilter {
  startDate?: Date;
  endDate?: Date;
  keywords?: string[];
  from?: string;
  to?: string;
  subject?: string;
  maxResults?: number;
}

export interface FetchedEmail {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date: Date;
  body: string;
  snippet: string;
  hasAttachments: boolean;
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: Buffer; // Raw attachment data
}

// ============================================================================
// GMAIL EMAIL FETCHING
// ============================================================================

/**
 * Build Gmail search query from filters
 */
function buildGmailQuery(filter: EmailFilter): string {
  const parts: string[] = [];

  if (filter.startDate) {
    const dateStr = filter.startDate.toISOString().split('T')[0].replace(/-/g, '/');
    parts.push(`after:${dateStr}`);
  }

  if (filter.endDate) {
    const dateStr = filter.endDate.toISOString().split('T')[0].replace(/-/g, '/');
    parts.push(`before:${dateStr}`);
  }

  if (filter.keywords && filter.keywords.length > 0) {
    const keywordQuery = filter.keywords.map(k => `"${k}"`).join(' OR ');
    parts.push(`(${keywordQuery})`);
  }

  if (filter.from) {
    parts.push(`from:${filter.from}`);
  }

  if (filter.to) {
    parts.push(`to:${filter.to}`);
  }

  if (filter.subject) {
    parts.push(`subject:"${filter.subject}"`);
  }

  return parts.join(' ');
}

/**
 * Fetch emails from Gmail
 */
export async function fetchGmailEmails(
  accessToken: string,
  filter: EmailFilter = {}
): Promise<FetchedEmail[]> {
  const oauth2Client = createGmailOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Build search query
  const query = buildGmailQuery(filter);
  const maxResults = filter.maxResults || 100;

  console.log(`[EMAIL_SERVICE] Fetching Gmail emails with query: ${query}`);

  // List messages
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messages = listResponse.data.messages || [];
  console.log(`[EMAIL_SERVICE] Found ${messages.length} Gmail messages`);

  // Fetch full message details
  const emails: FetchedEmail[] = [];

  for (const message of messages) {
    if (!message.id) continue;

    try {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });

      const email = parseGmailMessage(fullMessage.data);
      if (email) {
        emails.push(email);
      }
    } catch (error) {
      console.error(`[EMAIL_SERVICE] Error fetching Gmail message ${message.id}:`, error);
    }
  }

  return emails;
}

/**
 * Parse Gmail message into FetchedEmail format
 */
function parseGmailMessage(message: any): FetchedEmail | null {
  if (!message.id) return null;

  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const to = getHeader('To');
  const cc = getHeader('Cc');
  const date = getHeader('Date');

  // Extract email address and name from "Name <email@example.com>" format
  const parseEmailAddress = (str: string) => {
    const match = str.match(/<(.+?)>/);
    return match ? match[1] : str;
  };

  const parseName = (str: string) => {
    const match = str.match(/^(.+?)\s*</);
    return match ? match[1].replace(/"/g, '').trim() : '';
  };

  // Get email body
  let body = '';
  let snippet = message.snippet || '';

  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    // Multi-part message, find text/html or text/plain
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
        if (part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
    }
  }

  // Parse attachments
  const attachments: EmailAttachment[] = [];
  if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        });
      }
    }
  }

  return {
    messageId: message.id,
    threadId: message.threadId || message.id,
    subject,
    from: parseEmailAddress(from),
    fromName: parseName(from) || parseEmailAddress(from),
    to: to.split(',').map((e: string) => parseEmailAddress(e.trim())).filter(Boolean),
    cc: cc ? cc.split(',').map((e: string) => parseEmailAddress(e.trim())).filter(Boolean) : [],
    bcc: [],
    date: new Date(date),
    body,
    snippet,
    hasAttachments: attachments.length > 0,
    labels: message.labelIds || [],
    isRead: !message.labelIds?.includes('UNREAD'),
    isStarred: message.labelIds?.includes('STARRED') || false,
    attachments,
  };
}

/**
 * Download Gmail attachment
 */
export async function downloadGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const oauth2Client = createGmailOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  if (!response.data.data) {
    throw new Error('No attachment data received');
  }

  return Buffer.from(response.data.data, 'base64');
}

// ============================================================================
// OUTLOOK EMAIL FETCHING
// ============================================================================

/**
 * Build Outlook Graph API filter from EmailFilter
 */
function buildOutlookFilter(filter: EmailFilter): string {
  const parts: string[] = [];

  if (filter.startDate) {
    const dateStr = filter.startDate.toISOString();
    parts.push(`receivedDateTime ge ${dateStr}`);
  }

  if (filter.endDate) {
    const dateStr = filter.endDate.toISOString();
    parts.push(`receivedDateTime le ${dateStr}`);
  }

  if (filter.from) {
    parts.push(`from/emailAddress/address eq '${filter.from}'`);
  }

  if (filter.subject) {
    parts.push(`contains(subject, '${filter.subject}')`);
  }

  return parts.join(' and ');
}

/**
 * Fetch emails from Outlook/Microsoft Graph
 */
export async function fetchOutlookEmails(
  accessToken: string,
  filter: EmailFilter = {}
): Promise<FetchedEmail[]> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const maxResults = filter.maxResults || 100;
  const filterQuery = buildOutlookFilter(filter);

  console.log(`[EMAIL_SERVICE] Fetching Outlook emails with filter: ${filterQuery}`);

  let request = client.api('/me/messages').top(maxResults).select([
    'id',
    'conversationId',
    'subject',
    'from',
    'toRecipients',
    'ccRecipients',
    'bccRecipients',
    'receivedDateTime',
    'body',
    'bodyPreview',
    'hasAttachments',
    'isRead',
    'flag',
  ]);

  if (filterQuery) {
    request = request.filter(filterQuery);
  }

  // Add keyword search if provided
  if (filter.keywords && filter.keywords.length > 0) {
    const searchQuery = filter.keywords.join(' OR ');
    request = request.search(searchQuery);
  }

  const response = await request.get();
  const messages = response.value || [];

  console.log(`[EMAIL_SERVICE] Found ${messages.length} Outlook messages`);

  return messages.map((message: any) => parseOutlookMessage(message));
}

/**
 * Parse Outlook message into FetchedEmail format
 */
function parseOutlookMessage(message: any): FetchedEmail {
  return {
    messageId: message.id,
    threadId: message.conversationId || message.id,
    subject: message.subject || '',
    from: message.from?.emailAddress?.address || '',
    fromName: message.from?.emailAddress?.name || message.from?.emailAddress?.address || '',
    to: (message.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
    cc: (message.ccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
    bcc: (message.bccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean),
    date: new Date(message.receivedDateTime),
    body: message.body?.content || '',
    snippet: message.bodyPreview || '',
    hasAttachments: message.hasAttachments || false,
    labels: [],
    isRead: message.isRead || false,
    isStarred: message.flag?.flagStatus === 'flagged',
    attachments: [], // Attachments fetched separately
  };
}

/**
 * Download Outlook attachment
 */
export async function downloadOutlookAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const attachment = await client.api(`/me/messages/${messageId}/attachments/${attachmentId}`).get();

  if (!attachment.contentBytes) {
    throw new Error('No attachment data received');
  }

  return Buffer.from(attachment.contentBytes, 'base64');
}

/**
 * Upload attachment to S3 storage
 */
export async function uploadAttachmentToS3(
  attachment: EmailAttachment & { data: Buffer },
  caseId: string
): Promise<{ s3Key: string; s3Url: string }> {
  const fileExtension = attachment.filename.split('.').pop() || 'bin';
  const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const s3Key = `cases/${caseId}/email-attachments/${crypto.randomBytes(8).toString('hex')}-${safeFilename}`;

  const result = await storagePut(s3Key, attachment.data, attachment.mimeType);

  return {
    s3Key: result.key,
    s3Url: result.url,
  };
}

