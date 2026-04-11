import { z } from "zod";
import { nanoid } from "nanoid";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { supportTickets } from "../schema";

function effectiveUserId(ctx: { user: { id: string } | null }) {
  return ctx.user?.id ?? "demo-user-123";
}

export const supportRouter = router({
  submitTicket: publicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(80),
        subject: z.string().min(1).max(200),
        message: z.string().min(1).max(8000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const id = nanoid();
      const userId = effectiveUserId(ctx);
      await db.insert(supportTickets).values({
        id,
        userId,
        category: input.category,
        subject: input.subject,
        message: input.message,
        status: "open",
        createdAt: new Date(),
      });
      return { id, ok: true as const };
    }),
});
