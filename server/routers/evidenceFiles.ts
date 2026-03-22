import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  searchEvidenceFiles,
  getEvidenceFile,
  createEvidenceFile,
  deleteEvidenceFile,
  getEvidenceFilesByCase,
  getEvidenceStats,
} from "../evidence";

export const evidenceFilesRouter = router({
  search: protectedProcedure
    .input(
      z
        .object({
          caseId: z.string().optional(),
          query: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return searchEvidenceFiles({
        userId: ctx.user.id,
        caseId: input?.caseId,
        query: input?.query,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return getEvidenceFile(ctx.user.id, input.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        title: z.string(),
        type: z.enum(["document", "email", "chat", "photo", "video", "audio", "other"]),
        source: z.string().optional(),
        description: z.string().optional(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
        fileSize: z.string().optional(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createEvidenceFile(ctx.user.id, input);
      return { id };
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const success = await deleteEvidenceFile(ctx.user.id, input.id);
    return { success };
  }),

  byCase: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => getEvidenceFilesByCase(ctx.user.id, input.caseId)),

  stats: protectedProcedure.query(async ({ ctx }) => getEvidenceStats(ctx.user.id)),
});
