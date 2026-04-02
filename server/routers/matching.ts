import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { lawyers as lawyersTable } from '../schema';
import { eq } from "drizzle-orm";

export const matchingRouter = router({
  findMatches: publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { lawyers: [] };
      // Simple mock matching
      const lawyers = await db.select().from(lawyersTable).limit(5);
      return {
        lawyers: lawyers.map(l => ({ ...l, score: 95 }))
      };
    }),

  findLawyers: publicProcedure
    .input(z.object({
      caseId: z.string(),
      maxDistance: z.number().optional().default(100),
      maxResults: z.number().optional().default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const results = await db.select().from(lawyersTable).limit(input.maxResults);
      
      return results.map((l, index) => ({
        ...l,
        distance: Math.round(Math.random() * input.maxDistance),
        matchScore: 90 - index * 5,
        matchReasons: ["Relevant experience", "High response rate"],
        caseLoadScore: 45,
        responseTimeScore: 48,
        acceptanceRateScore: 42,
        capacityScore: 18,
        distanceScore: 9,
        experienceScore: 8,
      }));
    }),
});
