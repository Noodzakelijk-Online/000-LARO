import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  parseCaseCSV,
  createBulkImportJob,
  processBulkImport,
  getBulkImportJob,
  getUserBulkImportJobs,
} from '../bulkCaseImport';

/**
 * Bulk Import Router
 * Handle CSV file uploads and bulk case creation
 */

export const bulkImportRouter = router({
  /**
   * Upload and process CSV file
   */
  uploadCSV: protectedProcedure
    .input(
      z.object({
        csvContent: z.string(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Parse and validate CSV
      const parseResult = await parseCaseCSV(input.csvContent);

      if (!parseResult.valid) {
        return {
          success: false,
          errors: parseResult.errors,
        };
      }

      // Create bulk import job
      const jobId = await createBulkImportJob(
        userId,
        input.filename,
        parseResult.rows.length
      );

      // Process import in background (async, don't await)
      processBulkImport(jobId, userId, parseResult.rows).catch((error) => {
        console.error('[BulkImport] Processing error:', error);
      });

      return {
        success: true,
        jobId,
        totalRows: parseResult.rows.length,
      };
    }),

  /**
   * Get import job status
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await getBulkImportJob(input.jobId);

      if (!job) {
        throw new Error('Import job not found');
      }

      // Verify ownership
      if (job.userId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }

      return {
        id: job.id,
        filename: job.filename,
        status: job.status,
        totalRows: parseInt(job.totalRows),
        processedRows: parseInt(job.processedRows),
        failedRows: parseInt(job.failedRows),
        errors: job.errors ? JSON.parse(job.errors) : [],
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      };
    }),

  /**
   * Get all import jobs for current user
   */
  listJobs: protectedProcedure.query(async ({ ctx }) => {
    const jobs = await getUserBulkImportJobs(ctx.user.id);

    return jobs.map((job) => ({
      id: job.id,
      filename: job.filename,
      status: job.status,
      totalRows: parseInt(job.totalRows),
      processedRows: parseInt(job.processedRows),
      failedRows: parseInt(job.failedRows),
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }));
  }),
});
