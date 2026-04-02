import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  searchEvidenceFiles,
  getEvidenceFile,
  createEvidenceFile,
  deleteEvidenceFile,
  getEvidenceFilesByCase,
  getEvidenceStats,
} from "../evidence";
import { getDb } from "../db";
import { evidenceFiles } from "../schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export const evidenceFilesRouter = router({

  // Search / list evidence files
  search: publicProcedure
    .input(z.object({
      caseId: z.string().optional(),
      query:  z.string().optional(),
      limit:  z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id || "demo-user-123";
      const result = await searchEvidenceFiles({
        userId,
        caseId: input?.caseId,
        query:  input?.query,
        limit:  input?.limit,
        offset: input?.offset,
      });
      // Normalize: map evidence table rows to a consistent shape
      return result.files.map((f: any) => ({
        ...f,
        uploadSource: f.source ?? "manual",
        uploadedAt:   f.createdAt,
      }));
    }),

  // Get single file
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id || "demo-user-123";
      return getEvidenceFile(userId, input.id);
    }),

  // Create evidence file record
  create: publicProcedure
    .input(z.object({
      caseId:      z.string(),
      title:       z.string(),
      type:        z.enum(["document", "email", "chat", "photo", "video", "audio", "other"]),
      source:      z.string().optional(),
      description: z.string().optional(),
      fileUrl:     z.string().optional(),
      fileName:    z.string().optional(),
      fileSize:    z.string().optional(),
      mimeType:    z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id || "demo-user-123";
      const id = await createEvidenceFile(userId, input);
      return { id };
    }),

  // Delete
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id || "demo-user-123";
      const success = await deleteEvidenceFile(userId, input.id);
      return { success };
    }),

  // By case
  byCase: publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id || "demo-user-123";
      return getEvidenceFilesByCase(userId, input.caseId);
    }),

  // Stats
  stats: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id || "demo-user-123";
      return getEvidenceStats(userId);
  }),

  // Get download URL (for file preview)
  getDownloadUrl: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error("Not authenticated");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userId = ctx.user?.id || "demo-user-123";
      const file = await getEvidenceFile(userId, input.id);
      if (!file) throw new Error("File not found");

      // If file has a stored URL return it directly
      if ((file as any).fileUrl) return { url: (file as any).fileUrl };

      // Otherwise return a placeholder (real S3 presigned URL would go here)
      return { url: null, message: "File not available for download" };
    }),

  // Also search evidence_files table (desktop scanner uploads go here)
  searchScanned: publicProcedure
    .input(z.object({
      caseId: z.string().optional(),
      limit:  z.number().optional().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const userId = ctx.user?.id || "demo-user-123";
      const conditions: any[] = [eq(evidenceFiles.userId, userId)];
      if (input?.caseId) conditions.push(eq(evidenceFiles.caseId, input.caseId));

      return await db
        .select()
        .from(evidenceFiles)
        .where(and(...conditions))
        .orderBy(desc(evidenceFiles.uploadedAt))
        .limit(input?.limit ?? 50);
    }),
});