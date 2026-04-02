import { getDb } from './db';
import { notifyOwner } from './notification';
import {
  autoCollectionSettings,
  autoCollectionLogs,
  keywordMatches,
  emailMessages,
  googleDriveFiles,
} from './schema';
import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import { downloadAndUploadGoogleDriveFile, getGoogleDriveFileMetadata } from './googleDriveService';

/**
 * Evidence Auto-Collection Service
 * Automatically collects emails and files from Gmail and Google Drive based on keywords
 */

interface AutoCollectionConfig {
  caseId: string;
  userId: string;
  keywords: string[];
  keywordMatchMode: 'all' | 'any';
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  emailAccountIds: string[];
  googleDriveFolderIds?: string[];
  autoDownloadAttachments: boolean;
  autoDownloadGoogleDriveFiles: boolean;
}

/**
 * Get auto-collection settings for a case
 */
export async function getAutoCollectionSettings(caseId: string) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const settings = await db
    .select()
    .from(autoCollectionSettings)
    .where((t) => t.caseId === caseId)
    .limit(1);

  return settings.length > 0 ? settings[0] : null;
}

/**
 * Create or update auto-collection settings
 */
export async function upsertAutoCollectionSettings(config: AutoCollectionConfig) {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const existing = await getAutoCollectionSettings(config.caseId);

  const settingsData = {
    caseId: config.caseId,
    userId: config.userId,
    keywords: JSON.stringify(config.keywords),
    keywordMatchMode: config.keywordMatchMode,
    dateRangeStart: config.dateRangeStart,
    dateRangeEnd: config.dateRangeEnd,
    emailAccountIds: JSON.stringify(config.emailAccountIds),
    googleDriveFolderIds: config.googleDriveFolderIds ? JSON.stringify(config.googleDriveFolderIds) : null,
    autoDownloadAttachments: config.autoDownloadAttachments,
    autoDownloadGoogleDriveFiles: config.autoDownloadGoogleDriveFiles,
  };

  if (existing) {
    await db
      .update(autoCollectionSettings)
      .set(settingsData)
      .where((t) => t.caseId === config.caseId);
  } else {
    await db.insert(autoCollectionSettings).values({
      id: uuidv4(),
      ...settingsData,
      isEnabled: true,
      status: 'active',
    });
  }
}

/**
 * Check if text matches keywords
 */
function matchesKeywords(text: string, keywords: string[], mode: 'all' | 'any'): boolean {
  const lowerText = text.toLowerCase();
  const matchedKeywords = keywords.filter((kw) => lowerText.includes(kw.toLowerCase()));

  if (mode === 'all') {
    return matchedKeywords.length === keywords.length;
  } else {
    return matchedKeywords.length > 0;
  }
}

/**
 * Run auto-collection for a case
 */
export async function runAutoCollection(caseId: string): Promise<{
  emailsFound: number;
  emailsProcessed: number;
  filesFound: number;
  filesDownloaded: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const settings = await getAutoCollectionSettings(caseId);
  if (!settings) {
    throw new Error('Auto-collection settings not found for case');
  }

  const logId = uuidv4();
  const startTime = new Date();
  const errors: string[] = [];

  let emailsFound = 0;
  let emailsProcessed = 0;
  let filesFound = 0;
  let filesDownloaded = 0;

  try {
    const keywords = JSON.parse(settings.keywords);
    const emailAccountIds = JSON.parse(settings.emailAccountIds);
    const keywordMatchMode = settings.keywordMatchMode;

    // Collect emails from Gmail
    for (const accountId of emailAccountIds) {
      try {
        const emailsResult = await collectEmailsFromGmail(
          caseId,
          accountId,
          keywords,
          keywordMatchMode,
          settings.dateRangeStart || undefined,
          settings.dateRangeEnd || undefined
        );
        emailsFound += emailsResult.found;
        emailsProcessed += emailsResult.processed;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error collecting emails';
        errors.push(`Email collection error for account ${accountId}: ${errorMsg}`);
      }
    }

    // Collect files from Google Drive
    if (settings.autoDownloadGoogleDriveFiles) {
      const googleDriveFolderIds = settings.googleDriveFolderIds
        ? JSON.parse(settings.googleDriveFolderIds)
        : [];

      for (const folderId of googleDriveFolderIds) {
        try {
          const filesResult = await collectFilesFromGoogleDrive(
            caseId,
            folderId,
            keywords,
            keywordMatchMode
          );
          filesFound += filesResult.found;
          filesDownloaded += filesResult.downloaded;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error collecting files';
          errors.push(`File collection error for folder ${folderId}: ${errorMsg}`);
        }
      }
    }

    // Save log
    const executionTime = (new Date().getTime() - startTime.getTime()) / 1000;
    await db.insert(autoCollectionLogs).values({
      id: logId,
      caseId,
      settingsId: settings.id,
      userId: settings.userId,
      runStartedAt: startTime,
      runCompletedAt: new Date(),
      status: 'completed',
      emailsFound: String(emailsFound),
      emailsProcessed: String(emailsProcessed),
      filesFound: String(filesFound),
      filesDownloaded: String(filesDownloaded),
      errorCount: String(errors.length),
      executionTimeSeconds: String(Math.round(executionTime)),
    });

    // Update settings
    await db
      .update(autoCollectionSettings)
      .set({
        lastRunAt: new Date(),
        totalItemsCollected: String(emailsProcessed + filesDownloaded),
        totalEmailsCollected: String(emailsProcessed),
        totalFilesCollected: String(filesDownloaded),
      })
      .where((t) => t.caseId === caseId);

    return {
      emailsFound,
      emailsProcessed,
      filesFound,
      filesDownloaded,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);

    // Save failed log
    const executionTime = (new Date().getTime() - startTime.getTime()) / 1000;
    await db.insert(autoCollectionLogs).values({
      id: logId,
      caseId,
      settingsId: settings.id,
      userId: settings.userId,
      runStartedAt: startTime,
      runCompletedAt: new Date(),
      status: 'failed',
      errorMessage: errorMsg,
      errorCount: String(errors.length),
      executionTimeSeconds: String(Math.round(executionTime)),
    });

    throw error;
  }
}

/**
 * Collect emails from Gmail based on keywords
 */
async function collectEmailsFromGmail(
  caseId: string,
  accountId: string,
  keywords: string[],
  matchMode: 'all' | 'any',
  dateRangeStart?: Date,
  dateRangeEnd?: Date
): Promise<{
  found: number;
  processed: number;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  // Get email messages for this account and case
  let query = db.select().from(emailMessages).where((t) => t.accountId === accountId);

  if (dateRangeStart) {
    query = query.where((t) => t.date >= dateRangeStart);
  }
  if (dateRangeEnd) {
    query = query.where((t) => t.date <= dateRangeEnd);
  }

  const messages = await query;

  let found = 0;
  let processed = 0;

  for (const message of messages) {
    // Check if message matches keywords
    const searchText = `${message.subject || ''} ${message.body || ''} ${message.snippet || ''}`;
    const matches = matchesKeywords(searchText, keywords, matchMode);

    if (matches) {
      found++;

      // Link message to case if not already linked
      if (!message.caseId) {
        await db
          .update(emailMessages)
          .set({ caseId })
          .where((t) => t.id === message.id);
        processed++;
      }

      // Record keyword match
      const matchedKeywords = keywords.filter((kw) => searchText.toLowerCase().includes(kw.toLowerCase()));
      if (matchedKeywords.length > 0) {
        await db.insert(keywordMatches).values({
          id: uuidv4(),
          caseId,
          itemId: message.id,
          itemType: 'email',
          matchedKeywords: JSON.stringify(matchedKeywords),
          matchCount: String(matchedKeywords.length),
        });
      }
    }
  }

  return { found, processed };
}

/**
 * Collect files from Google Drive based on keywords
 */
async function collectFilesFromGoogleDrive(
  caseId: string,
  folderId: string,
  keywords: string[],
  matchMode: 'all' | 'any'
): Promise<{
  found: number;
  downloaded: number;
}> {
  // This is a placeholder - in production, you would:
  // 1. List files in the folder
  // 2. Check file names against keywords
  // 3. Download matching files
  // 4. Save to database

  return {
    found: 0,
    downloaded: 0,
  };
}

/**
 * Get auto-collection logs for a case
 */
export async function getAutoCollectionLogs(caseId: string, limit: number = 10) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const logs = await db
    .select()
    .from(autoCollectionLogs)
    .where((t) => t.caseId === caseId)
    .orderBy((t) => t.runStartedAt)
    .limit(limit);

  return logs;
}

/**
 * Run auto-collection for all cases with enabled settings
 * Called by cron scheduler daily at 2:00 AM
 */
export async function runAutoCollectionForAllCases(): Promise<{
  casesProcessed: number;
  emailsCollected: number;
  filesCollected: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  // Get all enabled auto-collection settings
  const enabledSettings = await db
    .select()
    .from(autoCollectionSettings)
    .where((t) => t.isEnabled === true && t.status === 'active');

  console.log(`[AutoCollection] Found ${enabledSettings.length} cases with enabled auto-collection`);

  let casesProcessed = 0;
  let totalEmailsCollected = 0;
  let totalFilesCollected = 0;
  const errors: string[] = [];

  for (const settings of enabledSettings) {
    try {
      console.log(`[AutoCollection] Processing case ${settings.caseId}...`);
      const result = await runAutoCollection(settings.caseId);
      casesProcessed++;
      totalEmailsCollected += result.emailsProcessed;
      totalFilesCollected += result.filesDownloaded;
      
      if (result.errors.length > 0) {
        errors.push(...result.errors.map(e => `Case ${settings.caseId}: ${e}`));
      }
      
      console.log(`[AutoCollection] Case ${settings.caseId}: ${result.emailsProcessed} emails, ${result.filesDownloaded} files`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Case ${settings.caseId}: ${errorMsg}`);
      console.error(`[AutoCollection] Error processing case ${settings.caseId}:`, errorMsg);
    }
  }

  // Send notification to owner about collection results
  if (casesProcessed > 0 || errors.length > 0) {
    try {
      const hasNewEvidence = totalEmailsCollected > 0 || totalFilesCollected > 0;
      const title = hasNewEvidence 
        ? `📧 Auto-Collection: ${totalEmailsCollected + totalFilesCollected} new items found`
        : `📧 Auto-Collection completed`;
      
      let content = `**Daily Evidence Auto-Collection Report**\n\n`;
      content += `- Cases processed: ${casesProcessed}\n`;
      content += `- Emails collected: ${totalEmailsCollected}\n`;
      content += `- Files collected: ${totalFilesCollected}\n`;
      
      if (errors.length > 0) {
        content += `\n**Errors (${errors.length}):**\n`;
        content += errors.slice(0, 5).map(e => `- ${e}`).join('\n');
        if (errors.length > 5) {
          content += `\n- ... and ${errors.length - 5} more errors`;
        }
      }
      
      await notifyOwner({ title, content });
      console.log('[AutoCollection] Notification sent to owner');
    } catch (notifyError) {
      console.error('[AutoCollection] Failed to send notification:', notifyError);
    }
  }

  return {
    casesProcessed,
    emailsCollected: totalEmailsCollected,
    filesCollected: totalFilesCollected,
    errors,
  };
}

/**
 * Get keyword matches for a case
 */
export async function getKeywordMatches(caseId: string) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const matches = await db
    .select()
    .from(keywordMatches)
    .where((t) => t.caseId === caseId);

  return matches;
}
