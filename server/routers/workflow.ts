import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cases as casesTable } from '../schema';
import { eq } from "drizzle-orm";

export const workflowRouter = router({
  initiateOutreach: publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Update case status to Outreach
      await db.update(casesTable)
        .set({ status: "Outreach", updatedAt: new Date() })
        .where(eq(casesTable.id, input.caseId));

      return { success: true };
    }),
});
