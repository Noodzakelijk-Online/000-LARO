import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { userPreferences } from "../schema";
import { nanoid } from "nanoid";

const DEFAULT_NOTIFICATION_SETTINGS = {
  newMessages: { email: true, push: true, inApp: true },
  caseStatusChanges: { email: true, push: true, inApp: true },
  evidenceAdded: { email: false, push: true, inApp: true },
  lawyerAssigned: { email: true, push: true, inApp: true },
  gapDetected: { email: false, push: false, inApp: true },
};

function effectiveUserId(ctx: { user: { id: string } | null }) {
  return ctx.user?.id ?? "demo-user-123";
}

async function getRow(userId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return row ?? null;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const userPreferencesRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    const userId = effectiveUserId(ctx);
    const row = await getRow(userId);

    return {
      dashboardWidgets: parseJson<Record<string, boolean>>(row?.dashboardWidgets ?? null, {}),
      notificationSettings: parseJson<typeof DEFAULT_NOTIFICATION_SETTINGS>(
        row?.notificationSettings ?? null,
        DEFAULT_NOTIFICATION_SETTINGS
      ),
      preferredLawyers: parseJson<unknown[]>(row?.preferredLawyers ?? null, []),
      caseTemplates: parseJson<unknown[]>(row?.caseTemplates ?? null, []),
    };
  }),

  updateWidgets: publicProcedure
    .input(z.record(z.boolean()))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: true };
      const userId = effectiveUserId(ctx);
      const existing = await getRow(userId);
      const merged = { ...parseJson(existing?.dashboardWidgets ?? null, {}), ...input };
      const payload = JSON.stringify(merged);

      if (existing) {
        await db
          .update(userPreferences)
          .set({ dashboardWidgets: payload, updatedAt: new Date() })
          .where(eq(userPreferences.userId, userId));
      } else {
        await db.insert(userPreferences).values({
          id: nanoid(),
          userId,
          dashboardWidgets: payload,
          updatedAt: new Date(),
        });
      }
      return { ok: true };
    }),

  updateNotifications: publicProcedure
    .input(z.any())
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: true };
      const userId = effectiveUserId(ctx);
      const existing = await getRow(userId);
      const prev = parseJson(existing?.notificationSettings ?? null, DEFAULT_NOTIFICATION_SETTINGS);

      let next: typeof DEFAULT_NOTIFICATION_SETTINGS & Record<string, unknown>;
      if (input && typeof input === "object" && "notificationSettings" in input && input.notificationSettings) {
        next = { ...prev, ...input.notificationSettings };
      } else if (input && typeof input === "object") {
        next = { ...prev, ...input };
      } else {
        next = prev;
      }

      const payload = JSON.stringify(next);

      if (existing) {
        await db
          .update(userPreferences)
          .set({ notificationSettings: payload, updatedAt: new Date() })
          .where(eq(userPreferences.userId, userId));
      } else {
        await db.insert(userPreferences).values({
          id: nanoid(),
          userId,
          notificationSettings: payload,
          updatedAt: new Date(),
        });
      }
      return { ok: true };
    }),

  togglePreferredLawyer: publicProcedure
    .input(z.object({ lawyerId: z.string() }))
    .mutation(async ({ ctx }) => {
      void ctx;
      return { ok: true };
    }),

  updateCaseTemplates: publicProcedure.input(z.any()).mutation(async () => ({ ok: true })),
});
