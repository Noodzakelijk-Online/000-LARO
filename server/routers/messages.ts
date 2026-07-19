import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { messages } from "../schema";

export const messagesRouter = router({
  list: protectedProcedure
    .input(z.object({ caseId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conditions = [eq(messages.userId, ctx.user.id)];
      if (input?.caseId) conditions.push(eq(messages.caseId, input.caseId));
      return db
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(100);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [message] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.id, input.id), eq(messages.userId, ctx.user.id)))
        .limit(1);
      return message ?? null;
    }),

  send: protectedProcedure
    .input(z.object({
      caseId: z.string().optional(),
      threadId: z.string().optional(),
      body: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const id = nanoid();
      await db.insert(messages).values({
        id,
        userId: ctx.user.id,
        caseId: input.caseId ?? null,
        threadId: input.threadId ?? null,
        content: input.body,
      } as any);
      return { id, success: true, deliveryStatus: "saved-locally" as const };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .delete(messages)
        .where(and(eq(messages.id, input.id), eq(messages.userId, ctx.user.id)));
      return { success: true };
    }),
});
