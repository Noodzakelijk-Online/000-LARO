// @ts-nocheck

import { createRequire } from "module";
import path from "path";
import { storageGet } from "./storage";

const require = createRequire(path.join(process.cwd(), "package.json"));
const pdfParse = require("pdf-parse");

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  pages: Array<{
    pageNumber: number;
    text: string;
  }>;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

/**
 * Extract text from PDF file
 * @param s3Key - S3 key of the PDF file
 * @returns Extracted text and metadata
 */
export async function extractTextFromPDF(
  s3Key: string
): Promise<PDFExtractionResult> {
  try {
    // Get presigned URL from S3
    const { url } = await storageGet(s3Key, 300);

    // Fetch PDF file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const data = await pdfParse(buffer, {
      // Extract text from each page separately
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        let lastY = -1;
        let text = "";

        for (const item of textContent.items) {
          // Add newline if Y position changed significantly
          if (lastY !== -1 && Math.abs(lastY - item.transform[5]) > 5) {
            text += "\n";
          }
          text += item.str;
          lastY = item.transform[5];
        }

        return text;
      },
    });

    // Extract page-by-page text
    const pages: Array<{ pageNumber: number; text: string }> = [];
    
    // Split full text by page breaks (heuristic)
    const pageTexts = data.text.split(/\n\s*\n\s*\n/); // Multiple blank lines indicate page break
    
    for (let i = 0; i < Math.min(pageTexts.length, data.numpages); i++) {
      pages.push({
        pageNumber: i + 1,
        text: pageTexts[i]?.trim() || "",
      });
    }

    // If heuristic didn't work, put all text in first page
    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        text: data.text,
      });
    }

    return {
      text: data.text,
      pageCount: data.numpages,
      pages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate
          ? new Date(data.info.CreationDate)
          : undefined,
        modificationDate: data.info?.ModDate
          ? new Date(data.info.ModDate)
          : undefined,
      },
    };
  } catch (error) {
    console.error("[PDF Extraction] Error:", error);
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Extract text from PDF file URL
 * @param url - Direct URL to PDF file
 * @returns Extracted text and metadata
 */
export async function extractTextFromPDFUrl(
  url: string
): Promise<PDFExtractionResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const data = await pdfParse(buffer);

    // Extract page-by-page text
    const pages: Array<{ pageNumber: number; text: string }> = [];
    const pageTexts = data.text.split(/\n\s*\n\s*\n/);
    
    for (let i = 0; i < Math.min(pageTexts.length, data.numpages); i++) {
      pages.push({
        pageNumber: i + 1,
        text: pageTexts[i]?.trim() || "",
      });
    }

    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        text: data.text,
      });
    }

    return {
      text: data.text,
      pageCount: data.numpages,
      pages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate
          ? new Date(data.info.CreationDate)
          : undefined,
        modificationDate: data.info?.ModDate
          ? new Date(data.info.ModDate)
          : undefined,
      },
    };
  } catch (error) {
    console.error("[PDF Extraction] Error:", error);
    throw new Error(
      `Failed to extract text from PDF URL: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
