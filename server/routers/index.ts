import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "../cookies";
import { systemRouter } from '../_core/systemRouter';
import { publicProcedure, router, protectedProcedure } from '../_core/trpc';
import { healthRouter } from "./health";
import { casesRouter } from "./cases";
import { lawyersRouter } from "./lawyers";
import { matchingRouter } from "./matching";
import { dashboardRouter } from "./dashboard";
import { outreachRouter } from "./outreach";
import { savedSearchesRouter } from "./savedSearches";
import { workflowRouter } from "./workflow";
import { evidenceFilesRouter } from "./evidenceFiles";
import { documentAnalysisRouter } from "./documentAnalysis";
import { searchRouter } from "./search";
import { messagesRouter } from "./messages";
import { lawyerRatingRouter } from "./lawyerRating";
import { trelloEnhancedRouter } from "./trelloEnhanced";
import { telegramEnhancedRouter } from "./telegramEnhanced";
import { gapAnalysisRouter } from "./gapAnalysis";
import { emailAccountsRouter } from "./emailAccounts";
import { evidenceAnalyticsRouter } from "./evidenceAnalytics";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ENV } from "../_core/env";
import { getUser, getDb } from "../db";
import { users } from "../schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  health: healthRouter,
  cases: casesRouter,
  lawyers: lawyersRouter,
  matching: matchingRouter,
  dashboard: dashboardRouter,
  outreach: outreachRouter,
  savedSearches: savedSearchesRouter,
  workflow: workflowRouter,
  evidenceFiles: evidenceFilesRouter,
  documentAnalysis: documentAnalysisRouter,
  search: searchRouter,
  messages: messagesRouter,
  lawyerRating: lawyerRatingRouter,
  trelloEnhanced: trelloEnhancedRouter,
  telegramEnhanced: telegramEnhancedRouter,
  gapAnalysis: gapAnalysisRouter,
  emailAccounts: emailAccountsRouter,
  evidenceAnalytics: evidenceAnalyticsRouter,




  // Auth procedures
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    
    signup: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(2),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "A user with this email already exists" });
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const userId = `USER${Date.now()}`;

        await db.insert(users).values({
          id: userId,
          email: input.email,
          password: hashedPassword,
          name: input.name,
          role: "user",
          createdAt: new Date(),
        });

        const token = jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: "365d" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true };
      }),

    login: publicProcedure
      .input(z.object({ 
        email: z.string().email(),
        password: z.string()
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const userResults = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        const user = userResults[0];

        if (!user || !user.password) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        const valid = await bcrypt.compare(input.password, user.password);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        const token = jwt.sign({ userId: user.id }, ENV.JWT_SECRET, {
          expiresIn: "365d",
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true, user };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Clarifications procedures
  clarifications: router({
    pending: protectedProcedure.query(() => []),
  }),
  
  // OCR procedures (placeholder for now)
  ocr: router({
    supportsOcr: protectedProcedure.input(z.any()).query(() => true),
    getStatus: protectedProcedure.input(z.any()).query(() => ({ status: "ready" })),
    getSupportedLanguages: protectedProcedure.query(() => ["nl", "en"]),
    extractText: protectedProcedure.mutation(() => ({ text: "Extracted text placeholder" })),
  }),

  // Analytics procedures
  analytics: router({
    getOverallStats: protectedProcedure.query(() => ({})),
    getOutreachTrends: protectedProcedure.query(() => []),
    getLawyerPerformance: protectedProcedure.query(() => []),
    getLegalAreaDistribution: protectedProcedure.query(() => []),
    getLawyerCapacity: protectedProcedure.query(() => []),
    getCaseDistribution: protectedProcedure.query(() => []),
    getWorkloadMetrics: protectedProcedure.query(() => []),
  }),



  // GDPR procedures
  gdpr: router({
    getConsent: publicProcedure.query(() => ({})),
    exportData: publicProcedure.mutation(() => ({})),
    deleteData: publicProcedure.mutation(() => ({})),
    updateConsent: publicProcedure.mutation(() => ({})),
  }),

  // Agent procedures
  agent: router({
    listDevices: publicProcedure.query(() => []),
    revokeDevice: publicProcedure.mutation(() => ({})),
  }),
});

export type AppRouter = typeof appRouter;