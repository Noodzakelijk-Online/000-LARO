import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { AUDIT_ACTIONS, createAuditLog } from "../audit";
import { buildCaseCsv, buildCaseZip } from "../evidenceExport";

function encodedDownload(filename: string, mimeType: string, buffer: Buffer) {
  return {
    filename,
    mimeType,
    base64: buffer.toString("base64"),
    bytes: buffer.length,
  };
}

export const evidenceExportRouter = router({
  getFormats: protectedProcedure.query(() => [
    { id: "csv" as const, label: "CSV spreadsheet", description: "Evidence index with scores and provenance hashes.", available: true },
    { id: "zip" as const, label: "ZIP evidence package", description: "Index, metadata, analyses, and available source documents.", available: true },
    { id: "pdf" as const, label: "PDF report", description: "Not available yet.", available: false },
  ]),

  exportCSV: protectedProcedure
    .input(z.object({ caseId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const buffer = await buildCaseCsv(ctx.user.id, input.caseId);
      await createAuditLog({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.EVIDENCE_EXPORTED,
        entityType: "case",
        entityId: input.caseId,
        details: { format: "csv", bytes: buffer.length },
      });
      return encodedDownload(`case-${input.caseId}-evidence.csv`, "text/csv;charset=utf-8", buffer);
    }),

  exportZIP: protectedProcedure
    .input(z.object({ caseId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const buffer = await buildCaseZip(ctx.user.id, input.caseId);
      await createAuditLog({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.EVIDENCE_EXPORTED,
        entityType: "case",
        entityId: input.caseId,
        details: { format: "zip", bytes: buffer.length },
      });
      return encodedDownload(`case-${input.caseId}-evidence.zip`, "application/zip", buffer);
    }),

  exportPDF: protectedProcedure
    .input(z.object({ caseId: z.string().min(1) }))
    .mutation(() => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "PDF export is not implemented. Use the ZIP evidence package or CSV index.",
      });
    }),
});
