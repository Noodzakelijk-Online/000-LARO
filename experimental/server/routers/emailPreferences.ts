import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../schema";
import { eq } from "drizzle-orm";

export interface EmailPreferences {
  usageAlerts80: boolean;
  usageAlerts100: boolean;
  marketing: boolean;
}

const defaultPreferences: EmailPreferences = {
  usageAlerts80: true,
  usageAlerts100: true,
  marketing: false,
};

export const emailPreferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return defaultPreferences;

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user[0]?.emailPreferences) return defaultPreferences;

    try {
      return JSON.parse(user[0].emailPreferences) as EmailPreferences;
    } catch {
      return defaultPreferences;
    }
  }),

  update: protectedProcedure
    .input(
      z.object({
        usageAlerts80: z.boolean().optional(),
        usageAlerts100: z.boolean().optional(),
        marketing: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const current = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      let prefs = { ...defaultPreferences };
      if (current[0]?.emailPreferences) {
        try {
          prefs = { ...prefs, ...(JSON.parse(current[0].emailPreferences) as EmailPreferences) };
        } catch {
          /* keep defaults */
        }
      }

      const next: EmailPreferences = {
        usageAlerts80: input.usageAlerts80 ?? prefs.usageAlerts80,
        usageAlerts100: input.usageAlerts100 ?? prefs.usageAlerts100,
        marketing: input.marketing ?? prefs.marketing,
      };

      await db
        .update(users)
        .set({ emailPreferences: JSON.stringify(next) })
        .where(eq(users.id, ctx.user.id));

      return next;
    }),
});
