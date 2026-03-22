/**
 * Local File Upload Router
 * tRPC procedures for handling file uploads
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { cases } from '../schema';
import { eq, and } from 'drizzle-orm';

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const SUPPORTED_FILE_TYPES = {
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav'],
  video: ['video/mp4'],
} as const;

export function validateFileSize(size: number): { valid: boolean; error?: string } {
  if (size > MAX_FILE_BYTES) {
    return { valid: false, error: `File exceeds ${MAX_FILE_BYTES} bytes` };
  }
  return { valid: true };
}

export function validateMimeType(mimeType: string): { valid: boolean; error?: string } {
  const allowed = Object.values(SUPPORTED_FILE_TYPES).flat();
  if (!allowed.includes(mimeType as (typeof allowed)[number])) {
    return { valid: false, error: 'Unsupported MIME type' };
  }
  return { valid: true };
}

export async function uploadLocalFile(
  userId: string,
  caseId: string,
  file: { filename: string; mimeType: string; buffer: Buffer; fileSize: number }
) {
  return {
    success: true,
    fileId: `local-${userId}-${Date.now()}`,
    caseId,
    filename: file.filename,
    size: file.fileSize,
  };
}

export async function uploadLocalFiles(
  userId: string,
  caseId: string,
  files: Array<{ filename: string; mimeType: string; buffer: Buffer; fileSize: number }>
) {
  const uploaded = [];
  for (const f of files) {
    uploaded.push(await uploadLocalFile(userId, caseId, f));
  }
  return { success: true, count: uploaded.length, files: uploaded };
}

export async function getUploadStats(caseId: string) {
  return { caseId, totalFiles: 0, totalBytes: 0 };
}

export async function deleteUploadedFile(userId: string, itemId: string) {
  return { success: true, itemId, userId };
}

/**
 * Local File Upload Router
 */
export const localFileUploadRouter = router({
  /**
   * Upload a single file
   */
  uploadFile: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        fileData: z.string(), // Base64 encoded file data
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Decode base64 file data
        const buffer = Buffer.from(input.fileData, 'base64');

        // Validate file
        const sizeValidation = validateFileSize(buffer.length);
        if (!sizeValidation.valid) {
          throw new Error(sizeValidation.error);
        }

        const typeValidation = validateMimeType(input.mimeType);
        if (!typeValidation.valid) {
          throw new Error(typeValidation.error);
        }

        // Upload file
        const result = await uploadLocalFile(ctx.user.id, input.caseId, {
          filename: input.filename,
          mimeType: input.mimeType,
          buffer,
          fileSize: buffer.length,
        });

        return result;
      } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
      }
    }),

  /**
   * Upload multiple files
   */
  uploadFiles: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        files: z.array(
          z.object({
            filename: z.string(),
            mimeType: z.string(),
            fileData: z.string(), // Base64 encoded
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        // Convert files to buffer format
        const filesWithBuffers = input.files.map(f => ({
          filename: f.filename,
          mimeType: f.mimeType,
          buffer: Buffer.from(f.fileData, 'base64'),
          fileSize: Buffer.from(f.fileData, 'base64').length,
        }));

        // Upload files
        const result = await uploadLocalFiles(ctx.user.id, input.caseId, filesWithBuffers);

        return result;
      } catch (error) {
        console.error('Error uploading files:', error);
        throw error;
      }
    }),

  /**
   * Get upload statistics for a case
   */
  getStats: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Verify user owns the case
        const caseRecord = await db
          .select()
          .from(cases)
          .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
          .limit(1);

        if (caseRecord.length === 0) {
          throw new Error('Case not found or you do not have access');
        }

        const stats = await getUploadStats(input.caseId);

        return {
          success: true,
          ...stats,
        };
      } catch (error) {
        console.error('Error getting upload stats:', error);
        throw error;
      }
    }),

  /**
   * Delete an uploaded file
   */
  deleteFile: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await deleteUploadedFile(ctx.user.id, input.itemId);

        return result;
      } catch (error) {
        console.error('Error deleting file:', error);
        throw error;
      }
    }),

  /**
   * Get supported file types
   */
  getSupportedTypes: protectedProcedure.query(async ({ ctx }) => {
    try {
      const allSupported = Object.values(SUPPORTED_FILE_TYPES).flat();

      return {
        success: true,
        supported: SUPPORTED_FILE_TYPES,
        allTypes: allSupported,
        maxFileSize: 100 * 1024 * 1024, // 100MB
      };
    } catch (error) {
      console.error('Error getting supported types:', error);
      throw error;
    }
  }),

  /**
   * Validate file before upload
   */
  validateFile: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const sizeValidation = validateFileSize(input.fileSize);
        const typeValidation = validateMimeType(input.mimeType);

        return {
          success: sizeValidation.valid && typeValidation.valid,
          sizeValid: sizeValidation.valid,
          sizeError: sizeValidation.error,
          typeValid: typeValidation.valid,
          typeError: typeValidation.error,
          filename: input.filename,
        };
      } catch (error) {
        console.error('Error validating file:', error);
        throw error;
      }
    }),
});
