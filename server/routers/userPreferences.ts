import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userPreferences } from "../schema";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const userPreferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [row] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);

    return {
      dashboardWidgets: parseJson<Record<string, boolean>>(row?.dashboardWidgets, {}),
      notificationSettings: parseJson<Record<string, unknown>>(row?.notificationSettings, {}),
      preferredLawyers: parseJson<unknown[]>(row?.preferredLawyers, []),
      caseTemplates: parseJson<unknown[]>(row?.caseTemplates, []),
    };
  }),
});
