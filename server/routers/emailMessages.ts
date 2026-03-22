import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * Email messages router — stub. The previous file was truncated.
 * Wire to emailMessages table + sync jobs when restoring full functionality.
 */
export const emailMessagesRouter = router({
  ping: protectedProcedure.query(() => ({
    ok: true as const,
    message: "emailMessages stub — restore sync/search procedures when ready",
  })),

  list: protectedProcedure
    .input(
      z
        .object({
          caseId: z.string().optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(async () => ({
      messages: [] as unknown[],
      total: 0,
    })),
});
