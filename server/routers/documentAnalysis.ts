import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * Document analysis router — stub. The previous module file was truncated in the workspace.
 * Restore LLM-backed analysis flows here when you have the full implementation.
 */
export const documentAnalysisRouter = router({
  ping: protectedProcedure.query(() => ({
    ok: true as const,
    message: "documentAnalysis stub — implement analysis procedures as needed",
  })),

  analyzeText: protectedProcedure
    .input(z.object({ text: z.string().max(50_000) }))
    .mutation(async () => ({
      summary: "Stub: connect to invokeLLM / document pipeline when ready.",
      entities: [] as string[],
    })),
});
