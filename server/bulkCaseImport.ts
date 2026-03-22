import { eq } from 'drizzle-orm';
import Papa from 'papaparse';
import { getDb } from './db';
import { bulkImportJobs, cases } from './schema';
import { nanoid } from 'nanoid';
import { aggregateCases, generateAggregationReport } from './caseAggregation';

/**
 * Bulk Case Import Service
 * Parse CSV files and create multiple cases with aggregation and consolidation
 */

export interface CaseCSVRow {
  caseTitle: string;
  description: string;
  category: string;
  urgency: string;
  evidenceUrls?: string; // Comma-separated URLs
  tags?: string; // Comma-separated tags
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
      transformHeader: (header) => {
        // Normalize headers (trim, lowercase)
        return header.trim().replace(/\s+/g, '');
      },
      complete: (results) => {
        // Validate required columns
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

        // Validate each row
        results.data.forEach((row, index) => {
          const rowErrors: string[] = [];

          if (!row.caseTitle?.trim()) {
            rowErrors.push(`Row ${index + 2}: Missing case title`);
          }
          if (!row.description?.trim()) {
            rowErrors.push(`Row ${index + 2}: Missing description`);
          }
          if (!row.category?.trim()) {
            rowErrors.push(`Row ${index + 2}: Missing category`);
          }
          if (!row.urgency?.trim()) {
            rowErrors.push(`Row ${index + 2}: Missing urgency`);
          }

          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
          } else {
            rows.push(row);
          }
        });

        resolve({
          valid: errors.length === 0,
          rows,
          errors,
        });
      },
      error: (error) => {
        errors.push(`CSV parsing error: ${error.message}`);
        resolve({ valid: false, rows: [], errors });
      },
    });
  });
}

/**
 * Create bulk import job
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
  });

  return jobId;
}

/**
 * Process bulk import job - create cases from CSV rows
 */
export async function processBulkImport(
  jobId: string,
  userId: string,
  rows: CaseCSVRow[]
): Promise<BulkImportResult> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Update job status to processing
  await db
    .update(bulkImportJobs)
    .set({ status: 'processing' })
    .where(eq(bulkImportJobs.id, jobId));

  // STEP 1: Aggregate cases to detect and merge duplicates
  const aggregationResult = aggregateCases(rows);
  console.log(`[BulkImport] Aggregation: ${aggregationResult.originalCount} rows → ${aggregationResult.consolidatedCount} cases (${aggregationResult.duplicatesRemoved} duplicates removed)`);

  const errors: Array<{ row: number; error: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  // STEP 2: Process aggregated cases
  for (let i = 0; i < aggregationResult.aggregatedCases.length; i++) {
    const aggregatedCase = aggregationResult.aggregatedCases[i];
    
    try {
      // Create case from aggregated data
      const caseId = nanoid();

      await db.insert(cases).values({
        id: caseId,
        userId,
        clientName: aggregatedCase.caseTitle,
        clientEmail: null,
        clientPhone: null,
        clientAddress: null,
        caseType: aggregatedCase.category,
        caseSummary: aggregatedCase.description,
        urgency: aggregatedCase.urgency as any,
        status: 'Matching',
        legalAreas: aggregatedCase.tags.length > 0 ? JSON.stringify(aggregatedCase.tags) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      successCount++;
      
      // Update progress
      await db
        .update(bulkImportJobs)
        .set({ processedRows: successCount.toString() })
        .where(eq(bulkImportJobs.id, jobId));

    } catch (error) {
      failureCount++;
      errors.push({
        row: aggregatedCase.rows[0], // Report first row number of the aggregated group
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Update failure count
      await db
        .update(bulkImportJobs)
        .set({ failedRows: failureCount.toString() })
        .where(eq(bulkImportJobs.id, jobId));
    }
  }

  // Update job status to completed
  await db
    .update(bulkImportJobs)
    .set({
      status: errors.length === rows.length ? 'failed' : 'completed',
      completedAt: new Date(),
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
    })
    .where(eq(bulkImportJobs.id, jobId));

  return {
    jobId,
    totalRows: rows.length,
    successCount,
    failureCount,
    errors,
    aggregation: {
      originalCount: aggregationResult.originalCount,
      consolidatedCount: aggregationResult.consolidatedCount,
      duplicatesRemoved: aggregationResult.duplicatesRemoved,
      report: generateAggregationReport(aggregationResult),
    },
  };
}

/**
 * Get bulk import job status
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
  if (!db) throw new Error('Database not available');

  return await db
    .select()
    .from(bulkImportJobs)
    .where(eq(bulkImportJobs.userId, userId))
    .orderBy(bulkImportJobs.createdAt);
}
