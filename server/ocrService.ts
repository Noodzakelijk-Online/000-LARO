/**
 * OCR Service
 * Extracts text from images and PDFs using Tesseract.js
 */

import Tesseract from 'tesseract.js';
import { getDb } from './db';
import { evidenceItems } from './schema';
import { eq } from 'drizzle-orm';

export interface OcrResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
  processingTime?: number;
}

interface OcrProgress {
  status: string;
  progress: number;
}

/**
 * Extract text from an image URL using Tesseract.js
 */
export async function extractTextFromImage(
  imageUrl: string,
  language: string = 'eng+nld', // English + Dutch
  onProgress?: (progress: OcrProgress) => void
): Promise<OcrResult> {
  const startTime = Date.now();

  try {
    console.log(`[OCR] Starting text extraction from: ${imageUrl}`);

    const result = await Tesseract.recognize(imageUrl, language, {
      logger: (m) => {
        if (onProgress && m.status) {
          onProgress({
            status: m.status,
            progress: Math.round((m.progress || 0) * 100),
          });
        }
      },
    });

    const processingTime = Date.now() - startTime;
    console.log(`[OCR] Extraction complete in ${processingTime}ms, confidence: ${result.data.confidence}%`);

    return {
      success: true,
      text: result.data.text,
      confidence: result.data.confidence,
      processingTime,
    };
  } catch (error) {
    console.error('[OCR] Error extracting text:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Save extracted text to evidence item metadata
 */
export async function saveExtractedText(
  itemId: string,
  extractedText: string,
  confidence: number
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get current item
    const items = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.id, itemId))
      .limit(1);

    if (items.length === 0) {
      throw new Error('Item not found');
    }

    const item = items[0];
    const currentMetadata = item.metadata ? JSON.parse(item.metadata) : {};

    // Update metadata with OCR results
    const updatedMetadata = {
      ...currentMetadata,
      ocrExtracted: true,
      ocrText: extractedText,
      ocrConfidence: confidence,
      ocrExtractedAt: new Date().toISOString(),
    };

    // Update content field with extracted text for search
    const updatedContent = item.content
      ? `${item.content}\n\n--- Extracted Text ---\n${extractedText}`
      : extractedText;

    await db
      .update(evidenceItems)
      .set({
        content: updatedContent,
        metadata: JSON.stringify(updatedMetadata),
        updatedAt: new Date(),
      })
      .where(eq(evidenceItems.id, itemId));

    console.log(`[OCR] Saved extracted text for item ${itemId}`);
    return true;
  } catch (error) {
    console.error('[OCR] Error saving extracted text:', error);
    return false;
  }
}

/**
 * Get OCR status for an item
 */
export async function getOcrStatus(itemId: string): Promise<{
  hasOcr: boolean;
  text?: string;
  confidence?: number;
  extractedAt?: string;
}> {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const items = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.id, itemId))
      .limit(1);

    if (items.length === 0) {
      return { hasOcr: false };
    }

    const metadata = items[0].metadata ? JSON.parse(items[0].metadata) : {};

    if (metadata.ocrExtracted) {
      return {
        hasOcr: true,
        text: metadata.ocrText,
        confidence: metadata.ocrConfidence,
        extractedAt: metadata.ocrExtractedAt,
      };
    }

    return { hasOcr: false };
  } catch (error) {
    console.error('[OCR] Error getting OCR status:', error);
    return { hasOcr: false };
  }
}

/**
 * Check if file type supports OCR
 */
export function supportsOcr(mimeType: string): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ];
  return supportedTypes.includes(mimeType);
}
