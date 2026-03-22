import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userPreferences } from "../schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const userPreferencesRouter = router({
  // Get current user's preferences
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);

    if (!prefs) {
      // Create default preferences
      const id = nanoid();
      await db.insert(userPreferences).values({
        id,
        userId: ctx.user.id,
        dashboardWidgets: JSON.stringify({
          caseStats: true,
          progress: true,
          recentActivity: true,
          upcomingDeadlines: true,
          lawyerMatches: true,
        }),
        notificationSettings: JSON.stringify({
          email: true,
          push: false,
          sms: false,
          caseUpdates: true,
          lawyerResponses: true,
          deadlineReminders: true,
        }),
        preferredLawyers: JSON.stringify([]),
        caseTemplates: JSON.stringify([]),
      });

      const [newPrefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      return {
        ...newPrefs,
        dashboardWidgets: JSON.parse(newPrefs.dashboardWidgets || "{}"),
        notificationSettings: JSON.parse(newPrefs.notificationSettings || "{}"),
        preferredLawyers: JSON.parse(newPrefs.preferredLawyers || "[]"),
        caseTemplates: JSON.parse(newPrefs.caseTemplates || "[]"),
      };
    }

    return {
      ...prefs,
      dashboardWidgets: prefs.dashboardWidgets ? JSON.parse(prefs.dashboardWidgets) : {},
      notificationSettings: prefs.notificationSettings ? JSON.parse(prefs.notificationSettings) : {},
      preferredLawyers: prefs.preferredLawyers ? JSON.parse(prefs.preferredLawyers) : [],
      caseTemplates: prefs.caseTemplates ? JSON.parse(prefs.caseTemplates) : [],
    };
  }),

  // Update dashboard widgets
  updateWidgets: protectedProcedure
    .input(z.record(z.boolean()))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(userPreferences)
        .set({ dashboardWidgets: JSON.stringify(input) })
        .where(eq(userPreferences.userId, ctx.user.id));

      return { success: true };
    }),

  // Update notification settings
  updateNotifications: protectedProcedure
    .input(z.record(z.boolean()))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(userPreferences)
        .set({ notificationSettings: JSON.stringify(input) })
        .where(eq(userPreferences.userId, ctx.user.id));

      return { success: true };
    }),

  // Update preferred lawyers
  updatePreferredLawyers: protectedProcedure
    .input(z.array(z.string()))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(userPreferences)
        .set({ preferredLawyers: JSON.stringify(input) })
        .where(eq(userPreferences.userId, ctx.user.id));

      return { success: true };
    }),

  // Toggle preferred lawyer
  togglePreferredLawyer: protectedProcedure
    .input(z.object({ lawyerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [prefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      const currentLawyers = prefs?.preferredLawyers
        ? JSON.parse(prefs.preferredLawyers)
        : [];

      const index = currentLawyers.indexOf(input.lawyerId);
      if (index > -1) {
        currentLawyers.splice(index, 1);
      } else {
        currentLawyers.push(input.lawyerId);
      }

      await db
        .update(userPreferences)
        .set({ preferredLawyers: JSON.stringify(currentLawyers) })
        .where(eq(userPreferences.userId, ctx.user.id));

      return { success: true, isPreferred: index === -1 };
    }),

  // Update case templates
  updateCaseTemplates: protectedProcedure
    .input(z.array(z.object({
      id: z.string(),
      name: z.string(),
      caseType: z.string(),
      description: z.string(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(userPreferences)
        .set({ caseTemplates: JSON.stringify(input) })
        .where(eq(userPreferences.userId, ctx.user.id));

      return { success: true };
    }),

  // Update theme
  updateTheme: protectedProcedure
    .input(z.enum(["light", "dark", "system"]))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(userPreferences)
        .set({ theme: input })
        .where(eq(userPreferences.userId, ctx.user.id));

      return { success: true };
    }),
});

