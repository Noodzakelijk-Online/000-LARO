/**
 * OneDrive Service
 * Integrates with Microsoft Graph API to access OneDrive files
 * Follows same pattern as Google Drive service
 */

import { storagePut } from './storage';
import { getDb } from './db';
import { evidenceSources, evidenceItems } from './schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import fetch from 'isomorphic-fetch';

interface OneDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedDateTime?: string;
  webUrl?: string;
  folder?: { childCount: number };
}

interface SyncProgress {
  totalFiles: number;
  processedFiles: number;
  extractedContent: number;
  errors: string[];
}

/**
 * List all files in OneDrive
 */
export async function listAllOneDriveFiles(
  accessToken: string,
  folderId: string = 'root',
  pageToken?: string
): Promise<{
  files: OneDriveFile[];
  nextPageToken?: string;
}> {
  try {
    const url = pageToken
      ? pageToken
      : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$top=200`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list OneDrive files: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Filter out folders, keep only files
    const files = (data.value || [])
      .filter((item: any) => !item.folder)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        mimeType: item.file?.mimeType || 'application/octet-stream',
        size: item.size,
        modifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
      }));

    return {
      files,
      nextPageToken: data['@odata.nextLink'],
    };
  } catch (error) {
    console.error('[OneDrive] Error listing files:', error);
    throw error;
  }
}

/**
 * Get all folders in OneDrive
 */
export async function getAllOneDriveFolders(
  accessToken: string,
  parentFolderId: string = 'root'
): Promise<OneDriveFile[]> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children?$top=200`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list OneDrive folders: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Filter to only folders
    return (data.value || [])
      .filter((item: any) => item.folder)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        mimeType: 'application/vnd.microsoft.folder',
        folder: item.folder,
      }));
  } catch (error) {
    console.error('[OneDrive] Error listing folders:', error);
    throw error;
  }
}

/**
 * Download file from OneDrive
 */
export async function downloadOneDriveFile(
  accessToken: string,
  fileId: string
): Promise<Buffer> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('[OneDrive] Error downloading file:', error);
    throw error;
  }
}

/**
 * Extract text content from file
 */
async function extractFileContent(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    // PDF
    if (mimeType.includes('pdf')) {
      const pdf = await pdfParse(fileBuffer);
      return pdf.text;
    }

    // Word documents
    if (
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc')
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }

    // Excel/Sheets
    if (
      mimeType.includes('sheet') ||
      mimeType.includes('excel') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      const workbook = XLSX.read(fileBuffer);
      let text = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `Sheet: ${sheetName}\n`;
        text += XLSX.utils.sheet_to_csv(sheet) + '\n';
      }
      return text;
    }

    // Images - OCR
    if (mimeType.startsWith('image/')) {
      try {
        const result = await Tesseract.recognize(fileBuffer, 'eng');
        return result.data.text;
      } catch (error) {
        console.warn('[OneDrive] OCR failed for image:', fileName);
        return `[Image: ${fileName}]`;
      }
    }

    // Plain text
    if (mimeType.includes('text') || fileName.endsWith('.txt')) {
      return fileBuffer.toString('utf-8');
    }

    return `[File: ${fileName}]`;
  } catch (error) {
    console.error('[OneDrive] Error extracting content from', fileName, ':', error);
    return `[Error extracting content from ${fileName}]`;
  }
}

/**
 * Connect OneDrive to a case
 */
export async function connectOneDrive(
  userId: string,
  caseId: string,
  accessToken: string
): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const sourceId = uuidv4();
  const now = new Date();

  await db.insert(evidenceSources).values({
    id: sourceId,
    userId,
    caseId,
    sourceType: 'OneDrive',
    status: 'connected',
    accessToken, // TODO: Encrypt in production
    itemsCollected: 0,
    lastSyncedAt: now,
    connectedAt: now,
  });

  console.log(`[OneDrive] Connected to case ${caseId}`);
  return sourceId;
}

/**
 * Get OneDrive connection status
 */
export async function getOneDriveStatus(caseId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const sources = await db
    .select()
    .from(evidenceSources)
    .where(
      and(
        eq(evidenceSources.caseId, caseId),
        eq(evidenceSources.sourceType, 'OneDrive')
      )
    )
    .limit(1);

  return sources.length > 0 ? sources[0] : null;
}

/**
 * Sync OneDrive files for a case
 */
export async function syncOneDriveForCase(
  userId: string,
  caseId: string,
  accessToken: string,
  sourceId: string
): Promise<SyncProgress> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const progress: SyncProgress = {
    totalFiles: 0,
    processedFiles: 0,
    extractedContent: 0,
    errors: [],
  };

  try {
    // List all files recursively
    let allFiles: OneDriveFile[] = [];
    let pageToken: string | undefined;
    let folderId = 'root';

    // Get all files from root
    while (true) {
      try {
        const result = await listAllOneDriveFiles(accessToken, folderId, pageToken);
        allFiles = allFiles.concat(result.files);
        progress.totalFiles += result.files.length;

        if (!result.nextPageToken) break;
        pageToken = result.nextPageToken;
      } catch (error) {
        console.error('[OneDrive] Error listing files:', error);
        progress.errors.push(`Failed to list files: ${error}`);
        break;
      }
    }

    console.log(`[OneDrive] Found ${allFiles.length} files for case ${caseId}`);

    // Process each file
    for (const file of allFiles) {
      try {
        // Download file
        const fileBuffer = await downloadOneDriveFile(accessToken, file.id);

        // Extract content
        const content = await extractFileContent(file.name, fileBuffer, file.mimeType);

        // Upload to S3
        const s3Key = `evidence/${caseId}/${file.id}/${file.name}`;
        const { url } = await storagePut(s3Key, fileBuffer, file.mimeType);

        // Store in database
        await db.insert(evidenceItems).values({
          id: uuidv4(),
          sourceId,
          caseId,
          userId,
          fileName: file.name,
          fileType: file.mimeType,
          fileSize: file.size || 0,
          s3Url: url,
          extractedContent: content.substring(0, 10000), // Limit to 10k chars
          uploadedAt: new Date(),
        });

        progress.processedFiles++;
        progress.extractedContent++;
      } catch (error) {
        console.error('[OneDrive] Error processing file', file.name, ':', error);
        progress.errors.push(`Failed to process ${file.name}: ${error}`);
      }
    }

    // Update source status
    await db
      .update(evidenceSources)
      .set({
        status: 'synced',
        itemsCollected: progress.extractedContent,
        lastSyncedAt: new Date(),
      })
      .where(eq(evidenceSources.id, sourceId));

    console.log(`[OneDrive] Sync complete for case ${caseId}:`, progress);
    return progress;
  } catch (error) {
    console.error('[OneDrive] Sync failed:', error);
    progress.errors.push(`Sync failed: ${error}`);

    // Update source with error
    await db
      .update(evidenceSources)
      .set({
        status: 'error',
        errorMessage: String(error),
      })
      .where(eq(evidenceSources.id, sourceId));

    throw error;
  }
}

/**
 * Disconnect OneDrive from a case
 */
export async function disconnectOneDrive(sourceId: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  await db.update(evidenceSources).set({ status: 'disconnected' }).where(eq(evidenceSources.id, sourceId));

  console.log(`[OneDrive] Disconnected source ${sourceId}`);
}
