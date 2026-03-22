import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  exportEvidenceAsPDF,
  exportEvidenceAsCSV,
  exportEvidenceAsZIP,
  getExportFormats,
} from "../evidenceExportService";
import { TRPCError } from "@trpc/server";

export const evidenceExportRouter = router({
  /**
   * Get available export formats
   */
  getFormats: protectedProcedure.query(() => {
    return getExportFormats();
  }),

  /**
   * Export evidence as PDF
   */
  exportPDF: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "Case ID is required"),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { url, key } = await exportEvidenceAsPDF(input.caseId, input.fileName);
        return {
          success: true,
          format: "pdf",
          url,
          key,
          downloadUrl: url,
          message: "Evidence exported as PDF successfully",
        };
      } catch (error) {
        console.error("[Export Router] Error exporting PDF:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export evidence as PDF",
        });
      }
    }),

  /**
   * Export evidence as CSV
   */
  exportCSV: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "Case ID is required"),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { url, key } = await exportEvidenceAsCSV(input.caseId, input.fileName);
        return {
          success: true,
          format: "csv",
          url,
          key,
          downloadUrl: url,
          message: "Evidence exported as CSV successfully",
        };
      } catch (error) {
        console.error("[Export Router] Error exporting CSV:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export evidence as CSV",
        });
      }
    }),

  /**
   * Export evidence as ZIP
   */
  exportZIP: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "Case ID is required"),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { url, key } = await exportEvidenceAsZIP(input.caseId, input.fileName);
        return {
          success: true,
          format: "zip",
          url,
          key,
          downloadUrl: url,
          message: "Evidence exported as ZIP successfully",
        };
      } catch (error) {
        console.error("[Export Router] Error exporting ZIP:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export evidence as ZIP",
        });
      }
    }),

  /**
   * Export evidence in all formats
   */
  exportAll: protectedProcedure
    .input(
      z.object({
        caseId: z.string().min(1, "Case ID is required"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const [pdfResult, csvResult, zipResult] = await Promise.all([
          exportEvidenceAsPDF(input.caseId),
          exportEvidenceAsCSV(input.caseId),
          exportEvidenceAsZIP(input.caseId),
        ]);

        return {
          success: true,
          exports: {
            pdf: {
              format: "pdf",
              url: pdfResult.url,
              key: pdfResult.key,
            },
            csv: {
              format: "csv",
              url: csvResult.url,
              key: csvResult.key,
            },
            zip: {
              format: "zip",
              url: zipResult.url,
              key: zipResult.key,
            },
          },
          message: "Evidence exported in all formats successfully",
        };
      } catch (error) {
        console.error("[Export Router] Error exporting all formats:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export evidence in all formats",
        });
      }
    }),
});
