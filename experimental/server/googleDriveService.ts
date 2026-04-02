import { google } from 'googleapis';
import { storagePut } from './storage';
import { getDb } from './db';
import { googleDriveFiles } from './schema';
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';

/**
 * Google Drive Service
 * Handles file operations with Google Drive API
 */

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface GoogleDriveServiceOptions {
  accessToken: string;
}

/**
 * Create a Google Drive client
 */
function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

/**
 * List files in Google Drive
 */
export async function listGoogleDriveFiles(
  accessToken: string,
  folderId?: string,
  pageToken?: string
): Promise<{
  files: GoogleDriveFile[];
  nextPageToken?: string;
}> {
  const drive = createDriveClient(accessToken);

  const query = folderId
    ? `'${folderId}' in parents and trashed=false`
    : "trashed=false and mimeType != 'application/vnd.google-apps.folder'";

  const response = await drive.files.list({
    q: query,
    spaces: 'drive',
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink), nextPageToken',
    pageSize: 50,
    pageToken,
  });

  return {
    files: (response.data.files || []) as GoogleDriveFile[],
    nextPageToken: response.data.nextPageToken,
  };
}

/**
 * Get file metadata from Google Drive
 */
export async function getGoogleDriveFileMetadata(
  accessToken: string,
  fileId: string
): Promise<GoogleDriveFile> {
  const drive = createDriveClient(accessToken);

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
  });

  return response.data as GoogleDriveFile;
}

/**
 * Download file from Google Drive and upload to S3
 */
export async function downloadAndUploadGoogleDriveFile(
  accessToken: string,
  fileId: string,
  fileName: string,
  mimeType: string
): Promise<{
  s3Key: string;
  s3Url: string;
}> {
  const drive = createDriveClient(accessToken);

  // Download file from Google Drive
  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    { responseType: 'stream' }
  );

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response.data as any) {
    chunks.push(chunk);
  }
  const fileBuffer = Buffer.concat(chunks);

  // Upload to S3
  const s3Key = `evidence/google-drive/${uuidv4()}-${fileName}`;
  const { key, url } = await storagePut(s3Key, fileBuffer, mimeType);

  return {
    s3Key: key,
    s3Url: url,
  };
}

/**
 * Save Google Drive file to database
 */
export async function saveGoogleDriveFileToDatabase(
  userId: string,
  caseId: string,
  accountId: string,
  fileData: GoogleDriveFile,
  s3Key: string,
  s3Url: string,
  mimeType: string
): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const fileId = uuidv4();

  // Determine evidence type from MIME type
  let evidenceType: 'document' | 'spreadsheet' | 'presentation' | 'image' | 'video' | 'audio' | 'other' = 'other';
  if (mimeType.includes('document') || mimeType.includes('pdf') || mimeType.includes('word')) {
    evidenceType = 'document';
  } else if (mimeType.includes('spreadsheet') || mimeType.includes('sheet')) {
    evidenceType = 'spreadsheet';
  } else if (mimeType.includes('presentation') || mimeType.includes('slide')) {
    evidenceType = 'presentation';
  } else if (mimeType.includes('image')) {
    evidenceType = 'image';
  } else if (mimeType.includes('video')) {
    evidenceType = 'video';
  } else if (mimeType.includes('audio')) {
    evidenceType = 'audio';
  }

  await db.insert(googleDriveFiles).values({
    id: fileId,
    userId,
    caseId,
    accountId,
    googleFileId: fileData.id,
    fileName: fileData.name,
    mimeType,
    fileSize: fileData.size,
    s3Key,
    s3Url,
    googleWebViewLink: fileData.webViewLink,
    googleModifiedTime: fileData.modifiedTime ? new Date(fileData.modifiedTime) : undefined,
    evidenceType,
    isIncluded: 'Yes',
  });

  return fileId;
}

/**
 * Get Google Drive files for a case
 */
export async function getGoogleDriveFilesForCase(caseId: string) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const files = await db
    .select()
    .from(googleDriveFiles)
    .where(eq(googleDriveFiles.caseId, caseId));

  return files;
}

/**
 * Delete Google Drive file from database (doesn't delete from S3)
 */
export async function deleteGoogleDriveFile(fileId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  await db.delete(googleDriveFiles).where(eq(googleDriveFiles.id, fileId));
}

/**
 * Update Google Drive file metadata
 */
export async function updateGoogleDriveFile(
  fileId: string,
  updates: {
    relevanceScore?: number;
    category?: string;
    userNotes?: string;
    isIncluded?: 'Yes' | 'No';
  }
) {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const updateData: any = {};
  if (updates.relevanceScore !== undefined) {
    updateData.relevanceScore = String(updates.relevanceScore);
  }
  if (updates.category) {
    updateData.category = updates.category;
  }
  if (updates.userNotes) {
    updateData.userNotes = updates.userNotes;
  }
  if (updates.isIncluded) {
    updateData.isIncluded = updates.isIncluded;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  await db
    .update(googleDriveFiles)
    .set(updateData)
    .where(eq(googleDriveFiles.id, fileId));
}
