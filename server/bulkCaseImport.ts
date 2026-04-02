import { eq } from 'drizzle-orm';
import Papa from 'papaparse';
import { getDb } from './db';
import { bulkImportJobs, cases, evidence } from './schema';
import { nanoid } from 'nanoid';
import { aggregateCases, generateAggregationReport } from './caseAggregation';

/**
 * Bulk Case Import Service
 * Parse CSV files and create multiple cases with evidence records
 */

export interface CaseCSVRow {
  caseTitle: string;
  description: string;
  category: string;
  urgency: string;
  evidenceUrls?: string; // Comma-separated URLs
  tags?: string;         // Comma-separated tags
}

export interface BulkImportResult {
  jobId: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; error: string }>;
  aggregation?: {
    originalCount: number;
    consolidatedCount: number;
    duplicatesRemoved: number;
    report: string;
  };
}

/**
 * Parse and validate CSV file
 */
export async function parseCaseCSV(csvContent: string): Promise<{
  valid: boolean;
  rows: CaseCSVRow[];
  errors: string[];
}> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const rows: CaseCSVRow[] = [];

    Papa.parse<CaseCSVRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/\s+/g, ''),
      complete: (results) => {
        const requiredColumns = ['caseTitle', 'description', 'category', 'urgency'];
        const headers = results.meta.fields || [];

        const missingColumns = requiredColumns.filter(col =>
          !headers.some(h => h.toLowerCase().replace(/\s+/g, '') === col.toLowerCase())
        );

        if (missingColumns.length > 0) {
          errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
          resolve({ valid: false, rows: [], errors });
          return;
        }

        results.data.forEach((row, index) => {
          const rowErrors: string[] = [];
          if (!row.caseTitle?.trim())   rowErrors.push(`Row ${index + 2}: Missing case title`);
          if (!row.description?.trim()) rowErrors.push(`Row ${index + 2}: Missing description`);
          if (!row.category?.trim())    rowErrors.push(`Row ${index + 2}: Missing category`);
          if (!row.urgency?.trim())     rowErrors.push(`Row ${index + 2}: Missing urgency`);

          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
          } else {
            rows.push(row);
          }
        });

        resolve({ valid: errors.length === 0, rows, errors });
      },
      error: (error: any) => {
        errors.push(`CSV parsing error: ${error.message}`);
        resolve({ valid: false, rows: [], errors });
      },
    });
  });
}

/**
 * Create bulk import job record
 */
export async function createBulkImportJob(
  userId: string,
  filename: string,
  totalRows: number
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const jobId = nanoid();

  await db.insert(bulkImportJobs).values({
    id: jobId,
    userId,
    filename,
    status: 'pending',
    totalRows: totalRows.toString(),
    processedRows: '0',
    failedRows: '0',
    errors: null,
  } as any);

  return jobId;
}

/**
 * Process bulk import — creates cases AND evidence records
 */
export async function processBulkImport(
  jobId: string,
  userId: string,
  rows: CaseCSVRow[]
): Promise<BulkImportResult> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Mark as processing
  await db
    .update(bulkImportJobs)
    .set({ status: 'processing' } as any)
    .where(eq(bulkImportJobs.id, jobId));

  const aggregationResult = aggregateCases(rows);
  console.log(`[BulkImport] Aggregation: ${aggregationResult.originalCount} rows → ${aggregationResult.consolidatedCount} cases (${aggregationResult.duplicatesRemoved} duplicates removed)`);

  const errors: Array<{ row: number; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < aggregationResult.aggregatedCases.length; i++) {
    const agg = aggregationResult.aggregatedCases[i];

    try {
      // ── 1. Create the case ───────────────────────────────────────────────
      const caseId = nanoid();

      await db.insert(cases).values({
        id: caseId,
        userId,
        clientName:   agg.caseTitle,
        clientEmail:  null,
        caseType:     agg.category,
        caseSummary:  agg.description,
        urgency:      normaliseUrgency(agg.urgency),
        status:       'active',
        legalAreas:   agg.tags.length > 0 ? JSON.stringify(agg.tags) : null,
      });

      // ── 2. Create a case-summary evidence record ─────────────────────────
      //    This ensures every imported case has at least one evidence item
      //    visible in the Evidence dashboard immediately after import.
      await db.insert(evidence).values({
        id:          nanoid(),
        caseId,
        userId,
        type:        'document',
        source:      'manual',
        title:       `Case Summary — ${agg.caseTitle}`,
        description: agg.description,
        tags:        agg.tags.length > 0 ? JSON.stringify(agg.tags) : null,
        relevant:    true,
      });

      // ── 3. Create evidence records for each URL ──────────────────────────
      if (agg.evidenceUrls && agg.evidenceUrls.length > 0) {
        for (const url of agg.evidenceUrls) {
          const trimmed = url.trim();
          if (!trimmed) continue;

          // Derive a readable filename from the URL
          const fileName = trimmed.split('/').pop()?.split('?')[0] ?? 'document';
          const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
          const evidenceType = getEvidenceType(ext);

          await db.insert(evidence).values({
            id:          nanoid(),
            caseId,
            userId,
            type:        evidenceType,
            source:      'manual',
            title:       fileName,
            description: `Imported from: ${trimmed}`,
            fileUrl:     trimmed,
            fileName,
            relevant:    true,
          });
        }
      }

      successCount++;

      // Update progress
      await db
        .update(bulkImportJobs)
        .set({ processedRows: successCount.toString() } as any)
        .where(eq(bulkImportJobs.id, jobId));

    } catch (error) {
      failureCount++;
      errors.push({
        row:   agg.rows[0],
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await db
        .update(bulkImportJobs)
        .set({ failedRows: failureCount.toString() } as any)
        .where(eq(bulkImportJobs.id, jobId));
    }
  }

  // Mark complete
  await db
    .update(bulkImportJobs)
    .set({
      status:      errors.length === rows.length ? 'failed' : 'completed',
      completedAt: new Date(),
      errors:      errors.length > 0 ? JSON.stringify(errors) : null,
    } as any)
    .where(eq(bulkImportJobs.id, jobId));

  return {
    jobId,
    totalRows:    rows.length,
    successCount,
    failureCount,
    errors,
    aggregation: {
      originalCount:     aggregationResult.originalCount,
      consolidatedCount: aggregationResult.consolidatedCount,
      duplicatesRemoved: aggregationResult.duplicatesRemoved,
      report:            generateAggregationReport(aggregationResult),
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseUrgency(raw: string): 'Low' | 'Medium' | 'High' {
  const v = raw.trim().toLowerCase();
  if (v === 'high')   return 'High';
  if (v === 'low')    return 'Low';
  return 'Medium';
}

function getEvidenceType(ext: string): 'document' | 'email' | 'photo' | 'other' {
  if (['pdf', 'doc', 'docx', 'txt', 'xlsx', 'csv'].includes(ext)) return 'document';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext))         return 'photo';
  if (['eml', 'msg'].includes(ext))                                 return 'email';
  return 'other';
}

/**
 * Get a single bulk import job
 */
export async function getBulkImportJob(jobId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db
    .select()
    .from(bulkImportJobs)
    .where(eq(bulkImportJobs.id, jobId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all bulk import jobs for a user
 */
export async function getUserBulkImportJobs(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(bulkImportJobs)
    .where(eq(bulkImportJobs.userId, userId));
}