import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  compileEvidence,
  getReport,
  getReportsForCase,
  getEntitiesForCase,
} from "../evidenceCompilerService";
import { extractTextFromPDF } from "../pdfExtractionService";
import {
  extractEntitiesFromText,
  classifyDocument,
} from "../entityExtractionService";

export const legalResearchRouter = router({
  // Compile evidence into a report
  compileEvidence: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        reportType: z.enum([
          "evidence_compilation",
          "case_law_research",
          "timeline_analysis",
          "entity_extraction",
          "comprehensive",
        ]),
        evidenceFileIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await compileEvidence({
        caseId: input.caseId,
        userId: ctx.user.id,
        reportType: input.reportType,
        evidenceFileIds: input.evidenceFileIds,
      });
    }),

  // Get report by ID
  getReport: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ input }) => {
      return await getReport(input.reportId);
    }),

  // Get all reports for a case
  getReportsForCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input }) => {
      return await getReportsForCase(input.caseId);
    }),

  // Get extracted entities for a case
  getEntitiesForCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input }) => {
      return await getEntitiesForCase(input.caseId);
    }),

  // Extract text from PDF (utility endpoint)
  extractPDFText: protectedProcedure
    .input(z.object({ s3Key: z.string() }))
    .mutation(async ({ input }) => {
      return await extractTextFromPDF(input.s3Key);
    }),

  // Extract entities from text (utility endpoint)
  extractEntities: protectedProcedure
    .input(
      z.object({
        text: z.string(),
        caseId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await extractEntitiesFromText(input.text, input.caseId);
    }),

  // Classify document (utility endpoint)
  classifyDocument: protectedProcedure
    .input(
      z.object({
        text: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await classifyDocument(input.text, input.fileName);
    }),
});
