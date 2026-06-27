import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { messageTemplates } from "../schema";
import { and, desc, eq, isNull, or } from "drizzle-orm";

/**
 * Message templates router.
 *
 * Powers the template picker in the Messages tab (CommunicationHub). Returns the
 * current user's saved templates plus any global (userId IS NULL) ones. If none
 * exist the component falls back to its built-in templates, so an empty list is
 * fine — this just surfaces DB-backed templates when present.
 */
export const messageTemplatesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const userId = ctx.user?.id;
    const where = userId
      ? or(eq(messageTemplates.userId, userId), isNull(messageTemplates.userId))
      : isNull(messageTemplates.userId);

    return db
      .select()
      .from(messageTemplates)
      .where(and(where))
      .orderBy(desc(messageTemplates.createdAt));
  }),
});
