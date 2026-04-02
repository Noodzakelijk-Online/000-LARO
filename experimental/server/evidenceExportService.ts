import { getAllEvidenceForCase } from "./evidenceQueryService";
import { storagePut } from "./storage";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import PDFDocument from "pdfkit";
import archiver from "archiver";

interface EvidenceItem {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  source: string;
  type: string;
  timestamp: Date;
  relevance: boolean;
  size?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Export evidence as PDF
 */
export async function exportEvidenceAsPDF(
  caseId: string,
  fileName?: string
): Promise<{ url: string; key: string }> {
  try {
    const { items } = await getAllEvidenceForCase(caseId, { limit: 1000 });

    // Create PDF document
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    // Temporary file path
    const tempDir = tmpdir();
    const tempFile = join(tempDir, `evidence-${randomBytes(8).toString("hex")}.pdf`);
    const stream = createWriteStream(tempFile);

    doc.pipe(stream);

    // Title
    doc.fontSize(24).font("Helvetica-Bold").text("Evidence Report", { align: "center" });
    doc.moveDown();

    // Case info
    doc.fontSize(12).font("Helvetica").text(`Case ID: ${caseId}`, { align: "left" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, { align: "left" });
    doc.text(`Total Items: ${items.length}`, { align: "left" });
    doc.moveDown();

    // Summary statistics
    const relevantCount = items.filter((i) => i.relevance).length;
    doc.fontSize(14).font("Helvetica-Bold").text("Summary", { underline: true });
    doc.fontSize(11).font("Helvetica");
    doc.text(`Total Evidence Items: ${items.length}`);
    doc.text(`Relevant Items: ${relevantCount}`);
    doc.text(`Irrelevant Items: ${items.length - relevantCount}`);
    doc.moveDown();

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {};
    items.forEach((item) => {
      sourceBreakdown[item.source] = (sourceBreakdown[item.source] || 0) + 1;
    });

    doc.fontSize(14).font("Helvetica-Bold").text("Source Breakdown", { underline: true });
    doc.fontSize(11).font("Helvetica");
    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      doc.text(`${source}: ${count} items`);
    });
    doc.moveDown();

    // Evidence items
    doc.fontSize(14).font("Helvetica-Bold").text("Evidence Items", { underline: true });
    doc.moveDown();

    items.forEach((item, index) => {
      doc.fontSize(12).font("Helvetica-Bold").text(`${index + 1}. ${item.title}`);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Source: ${item.source}`, { indent: 20 });
      doc.text(`Type: ${item.type}`, { indent: 20 });
      doc.text(`Date: ${new Date(item.timestamp).toLocaleDateString()}`, { indent: 20 });
      doc.text(`Relevant: ${item.relevance ? "Yes" : "No"}`, { indent: 20 });

      if (item.description) {
        doc.text(`Description: ${item.description}`, { indent: 20 });
      }

      if (item.tags && item.tags.length > 0) {
        doc.text(`Tags: ${item.tags.join(", ")}`, { indent: 20 });
      }

      doc.moveDown();

      // Add page break if needed
      if ((index + 1) % 5 === 0 && index + 1 < items.length) {
        doc.addPage();
      }
    });

    doc.end();

    // Wait for PDF to be written
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    // Upload to S3
    const fileBuffer = await fs.readFile(tempFile);
    const key = `exports/${caseId}/evidence-${Date.now()}.pdf`;
    const { url } = await storagePut(key, fileBuffer, "application/pdf");

    // Clean up temp file
    await fs.unlink(tempFile);

    return { url, key };
  } catch (error) {
    console.error("[Evidence Export] Error exporting to PDF:", error);
    throw error;
  }
}

/**
 * Export evidence as CSV
 */
export async function exportEvidenceAsCSV(
  caseId: string,
  fileName?: string
): Promise<{ url: string; key: string }> {
  try {
    const { items } = await getAllEvidenceForCase(caseId, { limit: 10000 });

    // CSV headers
    const headers = [
      "ID",
      "Title",
      "Description",
      "Source",
      "Type",
      "Date",
      "Relevant",
      "Size",
      "Tags",
    ];

    // CSV rows
    const rows = items.map((item) => [
      item.id,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${(item.description || "").replace(/"/g, '""')}"`,
      item.source,
      item.type,
      new Date(item.timestamp).toISOString(),
      item.relevance ? "Yes" : "No",
      item.size || "",
      item.tags ? `"${item.tags.join(", ")}"` : "",
    ]);

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    // Upload to S3
    const key = `exports/${caseId}/evidence-${Date.now()}.csv`;
    const { url } = await storagePut(key, csvContent, "text/csv");

    return { url, key };
  } catch (error) {
    console.error("[Evidence Export] Error exporting to CSV:", error);
    throw error;
  }
}

/**
 * Export evidence as ZIP (includes metadata JSON and CSV)
 */
export async function exportEvidenceAsZIP(
  caseId: string,
  fileName?: string
): Promise<{ url: string; key: string }> {
  try {
    const { items } = await getAllEvidenceForCase(caseId, { limit: 10000 });

    // Create temporary directory for ZIP contents
    const tempDir = tmpdir();
    const zipTempDir = join(tempDir, `evidence-zip-${randomBytes(8).toString("hex")}`);
    await fs.mkdir(zipTempDir, { recursive: true });

    // 1. Create JSON metadata file
    const metadataFile = join(zipTempDir, "metadata.json");
    const metadata = {
      caseId,
      exportDate: new Date().toISOString(),
      totalItems: items.length,
      relevantItems: items.filter((i) => i.relevance).length,
      items: items.map((item) => ({
        ...item,
        timestamp: item.timestamp.toISOString(),
      })),
    };
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));

    // 2. Create CSV file
    const headers = [
      "ID",
      "Title",
      "Description",
      "Source",
      "Type",
      "Date",
      "Relevant",
      "Size",
      "Tags",
    ];
    const rows = items.map((item) => [
      item.id,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${(item.description || "").replace(/"/g, '""')}"`,
      item.source,
      item.type,
      new Date(item.timestamp).toISOString(),
      item.relevance ? "Yes" : "No",
      item.size || "",
      item.tags ? `"${item.tags.join(", ")}"` : "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const csvFile = join(zipTempDir, "evidence.csv");
    await fs.writeFile(csvFile, csvContent);

    // 3. Create summary report
    const sourceBreakdown: Record<string, number> = {};
    const typeBreakdown: Record<string, number> = {};
    items.forEach((item) => {
      sourceBreakdown[item.source] = (sourceBreakdown[item.source] || 0) + 1;
      typeBreakdown[item.type] = (typeBreakdown[item.type] || 0) + 1;
    });

    const summaryContent = `
EVIDENCE EXPORT SUMMARY
=======================

Case ID: ${caseId}
Export Date: ${new Date().toLocaleDateString()}
Total Items: ${items.length}
Relevant Items: ${items.filter((i) => i.relevance).length}
Irrelevant Items: ${items.filter((i) => !i.relevance).length}

SOURCE BREAKDOWN
================
${Object.entries(sourceBreakdown)
  .map(([source, count]) => `${source}: ${count} items`)
  .join("\n")}

TYPE BREAKDOWN
==============
${Object.entries(typeBreakdown)
  .map(([type, count]) => `${type}: ${count} items`)
  .join("\n")}

FILES INCLUDED
==============
- metadata.json: Complete evidence data in JSON format
- evidence.csv: Evidence data in CSV format
- summary.txt: This summary report
`;

    const summaryFile = join(zipTempDir, "summary.txt");
    await fs.writeFile(summaryFile, summaryContent);

    // 4. Create ZIP archive
    const zipTempFile = join(tempDir, `evidence-${randomBytes(8).toString("hex")}.zip`);
    const output = createWriteStream(zipTempFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(zipTempDir, false);
    await archive.finalize();

    // Wait for ZIP to be written
    await new Promise((resolve, reject) => {
      output.on("finish", resolve);
      output.on("error", reject);
    });

    // Upload to S3
    const fileBuffer = await fs.readFile(zipTempFile);
    const key = `exports/${caseId}/evidence-${Date.now()}.zip`;
    const { url } = await storagePut(key, fileBuffer, "application/zip");

    // Clean up temp files
    await fs.rm(zipTempDir, { recursive: true });
    await fs.unlink(zipTempFile);

    return { url, key };
  } catch (error) {
    console.error("[Evidence Export] Error exporting to ZIP:", error);
    throw error;
  }
}

/**
 * Get export status and available formats
 */
export function getExportFormats() {
  return [
    {
      format: "pdf",
      label: "PDF Report",
      description: "Professional PDF report with summary and all evidence items",
      mimeType: "application/pdf",
    },
    {
      format: "csv",
      label: "CSV Spreadsheet",
      description: "Comma-separated values for import into Excel or other tools",
      mimeType: "text/csv",
    },
    {
      format: "zip",
      label: "ZIP Archive",
      description: "Complete export with JSON metadata, CSV, and summary report",
      mimeType: "application/zip",
    },
  ];
}
