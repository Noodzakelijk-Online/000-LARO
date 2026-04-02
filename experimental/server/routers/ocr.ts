/**
 * OCR Router
 * tRPC procedures for OCR text extraction
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  extractTextFromImage,
  saveExtractedText,
  getOcrStatus,
  supportsOcr,
} from '../ocrService';

export const ocrRouter = router({
  /**
   * Extract text from an image
   */
  extractText: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        imageUrl: z.string().url(),
        language: z.string().optional().default('eng+nld'),
        saveToItem: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const result = await extractTextFromImage(input.imageUrl, input.language);

      if (result.success && input.saveToItem && result.text) {
        await saveExtractedText(
          input.itemId,
          result.text,
          result.confidence || 0
        );
      }

      return result;
    }),

  /**
   * Get OCR status for an item
   */
  getStatus: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ input }) => {
      return getOcrStatus(input.itemId);
    }),

  /**
   * Check if file type supports OCR
   */
  supportsOcr: protectedProcedure
    .input(z.object({ mimeType: z.string() }))
    .query(({ input }) => {
      return { supported: supportsOcr(input.mimeType) };
    }),

  /**
   * Get supported languages for OCR
   */
  getSupportedLanguages: protectedProcedure.query(() => {
    return {
      languages: [
        { code: 'eng', name: 'English' },
        { code: 'nld', name: 'Dutch' },
        { code: 'deu', name: 'German' },
        { code: 'fra', name: 'French' },
        { code: 'spa', name: 'Spanish' },
        { code: 'ita', name: 'Italian' },
        { code: 'por', name: 'Portuguese' },
        { code: 'eng+nld', name: 'English + Dutch' },
        { code: 'eng+deu', name: 'English + German' },
      ],
    };
  }),
});
