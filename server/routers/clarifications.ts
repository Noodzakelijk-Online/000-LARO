import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { clarificationQuestions } from "../schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Clarifications Router
 * Schema columns: id, caseId, userId, question, answer, status, createdAt
 * Note: priority, askedAt, answeredAt, dismissedAt, context do NOT exist in schema
 */
export const clarificationsRouter = router({

  pending: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const db = await getDb();
    if (!db) return [];

    return await db
      .select()
      .from(clarificationQuestions)
      .where(and(
        eq(clarificationQuestions.userId, ctx.user.id),
        eq(clarificationQuestions.status, "Pending")
      ))
      // Only order by createdAt — priority/askedAt don't exist in schema
      .orderBy(desc(clarificationQuestions.createdAt));
  }),

  byCase: publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];

      return await db
        .select()
        .from(clarificationQuestions)
        .where(and(
          eq(clarificationQuestions.userId, ctx.user.id),
          eq(clarificationQuestions.caseId, input.caseId)
        ))
        .orderBy(desc(clarificationQuestions.createdAt));
    }),

  create: publicProcedure
    .input(z.object({
      caseId:   z.string(),
      question: z.string(),
      context:  z.string().optional(),  // accepted but not stored (not in schema)
      priority: z.enum(["Low", "Medium", "High"]).default("Medium"), // accepted but not stored
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("User must be authenticated");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const questionId = nanoid();

      await db.insert(clarificationQuestions).values({
        id:       questionId,
        userId:   ctx.user.id,
        caseId:   input.caseId,
        question: input.question,
        status:   "Pending",
        // context, priority, askedAt not in schema — omitted
      });

      return { id: questionId, success: true };
    }),

  answer: publicProcedure
    .input(z.object({
      questionId: z.string(),
      answer:     z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("User must be authenticated");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const question = await db
        .select()
        .from(clarificationQuestions)
        .where(eq(clarificationQuestions.id, input.questionId))
        .limit(1);

      if (!question.length || question[0].userId !== ctx.user.id) {
        throw new Error("Question not found or access denied");
      }

      await db
        .update(clarificationQuestions)
        .set({
          answer: input.answer,
          status: "Answered",
          // answeredAt not in schema — omitted
        })
        .where(eq(clarificationQuestions.id, input.questionId));

      return { success: true };
    }),

  dismiss: publicProcedure
    .input(z.object({ questionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error("User must be authenticated");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const question = await db
        .select()
        .from(clarificationQuestions)
        .where(eq(clarificationQuestions.id, input.questionId))
        .limit(1);

      if (!question.length || question[0].userId !== ctx.user.id) {
        throw new Error("Question not found or access denied");
      }

      await db
        .update(clarificationQuestions)
        .set({ status: "Dismissed" })
        .where(eq(clarificationQuestions.id, input.questionId));

      return { success: true };
    }),

  stats: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { pending: 0, answered: 0, dismissed: 0 };
    const db = await getDb();
    if (!db) return { pending: 0, answered: 0, dismissed: 0 };

    const all = await db
      .select()
      .from(clarificationQuestions)
      .where(eq(clarificationQuestions.userId, ctx.user.id));

    return {
      pending:   all.filter(q => q.status === "Pending").length,
      answered:  all.filter(q => q.status === "Answered").length,
      dismissed: all.filter(q => q.status === "Dismissed").length,
    };
  }),
});