import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { messages } from "../schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export const messagesRouter = router({

  list: protectedProcedure
    .input(z.object({
      caseId:    z.string().optional(),
      direction: z.string().optional(),
      status:    z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions: any[] = [eq(messages.userId, ctx.user.id)];
      if (input?.caseId) conditions.push(eq(messages.caseId, input.caseId));

      return await db
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
      if (!db) return null;
      const [msg] = await db.select().from(messages)
        .where(and(eq(messages.id, input.id), eq(messages.userId, ctx.user.id)))
        .limit(1);
      return msg ?? null;
    }),

  send: protectedProcedure
    .input(z.object({
      caseId:   z.string().optional(),
      threadId: z.string().optional(),
      body:     z.string().min(1),
      subject:  z.string().optional(),
      priority: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = nanoid();
      await db.insert(messages).values({
        id,
        userId:   ctx.user.id,
        caseId:   input.caseId   ?? null,
        threadId: input.threadId ?? null,
        // Store body in content column (schema uses content not body)
        content:  input.body,
      } as any);

      return { id, success: true, deliveryStatus: "saved-locally" as const };
    }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      // No readAt or status in base schema — just acknowledge
      return { success: false, reason: "Read tracking is not available for local message notes." };
    }),

  getUnreadCount: protectedProcedure.query(async () => {
    return 0; // Will be meaningful once direction column is added via SQL patch
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.delete(messages).where(and(eq(messages.id, input.id), eq(messages.userId, ctx.user.id)));
      return { success: true };
    }),
});
