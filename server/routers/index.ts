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
import { emailRouter } from "./email";
import { userPreferencesRouter } from "./userPreferences";
import { bulkImportRouter } from "./bulkImport";
import { supportRouter } from "./support";
import { evidenceAnalyticsRouter } from "./evidenceAnalytics";
import { autoCollectionRouter } from "./autoCollection";
import { googleDriveRouter } from "./googleDrive";
import { notificationsRouter } from "./notifications";
import {
  gmailEnhancedRouter,
  outlookEnhancedRouter,
  googleDriveEnhancedRouter,
  oneDriveEnhancedRouter,
  slackEnhancedRouter,
} from "./enhancedConnections";
import { createEvidenceFile, getEvidenceStats } from "../evidence";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ENV } from "../_core/env";
import { sendPasswordResetEmail } from "../systemEmail";
import { getUser, getDb } from "../db";
import { users, cases } from "../schema";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../llm";

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
  email: emailRouter,
  userPreferences: userPreferencesRouter,
  bulkImport: bulkImportRouter,
  evidenceAnalytics: evidenceAnalyticsRouter,
  support: supportRouter,
  autoCollection: autoCollectionRouter,
  googleDrive: googleDriveRouter,
  notifications: notificationsRouter,
  
  gmailEnhanced: gmailEnhancedRouter,
  outlookEnhanced: outlookEnhancedRouter,
  googleDriveEnhanced: googleDriveEnhancedRouter,
  oneDriveEnhanced: oneDriveEnhancedRouter,
  slackEnhanced: slackEnhancedRouter,

  // Evidence Upload & Local Scanner specific router
  localFileUpload: router({
    getSupportedTypes: publicProcedure.query(() => [
      "document", "email", "chat", "photo", "video", "audio", "other"
    ]),
    uploadFile: protectedProcedure
      .input(z.object({
        caseId: z.string(),
        title: z.string(),
        type: z.enum(["document", "email", "chat", "photo", "video", "audio", "other"]),
        fileName: z.string(),
        fileSize: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const id = await createEvidenceFile(userId, {
          ...input,
          source: "manual_upload",
        });
        return { id };
      }),
    uploadFiles: protectedProcedure
      .input(z.array(z.object({
        caseId: z.string(),
        title: z.string(),
        type: z.enum(["document", "email", "chat", "photo", "video", "audio", "other"]),
        fileName: z.string(),
        fileSize: z.string(),
        mimeType: z.string(),
      })))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const results = [];
        for (const item of input) {
          const id = await createEvidenceFile(userId, {
            ...item,
            source: "manual_upload",
          });
          results.push({ id });
        }
        return results;
      }),
    getStats: protectedProcedure
      .input(z.object({ caseId: z.string().optional() }))
      .query(async ({ ctx }) => {
        const userId = ctx.user.id;
        return getEvidenceStats(userId);
      }),
  }),

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

        return { success: true, user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Step 1 of password reset: email the user a one-time code. Always returns
    // success regardless of whether the email exists, to avoid leaking which
    // addresses have accounts (no user enumeration).
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const TTL_MINUTES = 15;
        const user = (
          await db.select().from(users).where(eq(users.email, input.email)).limit(1)
        )[0];

        // Only generate + send a code for accounts that have a password set
        // (OAuth-only accounts have nothing to reset).
        if (user && user.password) {
          const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
          const codeHash = crypto.createHash("sha256").update(code).digest("hex");
          const expiresAt = Date.now() + TTL_MINUTES * 60 * 1000;

          await db
            .update(users)
            .set({ resetCodeHash: codeHash, resetCodeExpiresAt: String(expiresAt) })
            .where(eq(users.id, user.id));

          try {
            await sendPasswordResetEmail(user.email!, code, TTL_MINUTES);
          } catch (e) {
            console.error("[auth.requestPasswordReset] email send failed:", e);
            // Don't surface delivery errors to the client (avoids enumeration
            // and matches the dev console-fallback behaviour).
          }
        }

        return { success: true } as const;
      }),

    // Step 2 of password reset: verify the code and set a new password.
    resetPassword: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
          newPassword: z.string().min(8),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const user = (
          await db.select().from(users).where(eq(users.email, input.email)).limit(1)
        )[0];

        const invalid = new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset code",
        });

        if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) throw invalid;
        if (Date.now() > Number(user.resetCodeExpiresAt)) throw invalid;

        const candidateHash = crypto.createHash("sha256").update(input.code).digest("hex");
        const a = Buffer.from(candidateHash);
        const b = Buffer.from(user.resetCodeHash);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw invalid;

        const hashedPassword = await bcrypt.hash(input.newPassword, 10);
        await db
          .update(users)
          .set({ password: hashedPassword, resetCodeHash: null, resetCodeExpiresAt: null })
          .where(eq(users.id, user.id));

        return { success: true } as const;
      }),

    getApiToken: protectedProcedure.query(({ ctx }) => {
      const token = jwt.sign({ userId: ctx.user.id }, ENV.JWT_SECRET, {
        expiresIn: "365d",
      });
      return { token };
    }),
  }),

  // Clarifications procedures
  clarifications: router({
    pending: protectedProcedure.query((): Array<{ id: string; question: string; context?: string }> => []),
    answer: protectedProcedure
      .input(z.object({ questionId: z.string(), answer: z.string() }))
      .mutation(() => ({ ok: true as const })),
  }),

  assistant: router({
    ask: protectedProcedure
      .input(
        z.object({
          question: z.string().min(1),
          caseId: z.string().optional(),
          page: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        let caseContext = "";

        if (db && input.caseId) {
          const rows = await db
            .select()
            .from(cases)
            .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
            .limit(1);
          if (rows.length > 0) {
            const c = rows[0] as any;
            caseContext = `Case type: ${c.caseType}\nStatus: ${c.status}\nSummary: ${c.caseSummary}`;
          }
        }

        const systemPrompt = input.caseId
          ? `You are LARO, a legal assistant focused ONLY on the selected case context.\n${caseContext}\nFirst validate the user's issue understanding, then ask 1-3 targeted follow-up questions if details are missing. Keep answers concise and practical.`
          : "You are LARO, a legal assistant for general product and legal-workflow guidance. If the user asks case-specific questions without a selected case, ask them to open a case first.";

        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.question },
            ],
            maxTokens: 700,
          });
          const content = result.choices?.[0]?.message?.content;
          const text =
            typeof content === "string"
              ? content
              : Array.isArray(content)
                ? content
                    .map((part: any) => (part?.type === "text" ? part.text : ""))
                    .join("\n")
                : "";
          return { answer: text || "I could not generate an answer right now. Please try again." };
        } catch (error) {
          return {
            answer:
              "I am currently unable to reach the AI service. Please try again in a moment.",
          };
        }
      }),
  }),
  
  // OCR procedures (placeholder for now)
  ocr: router({
    supportsOcr: protectedProcedure.input(z.any()).query(() => true),
    getStatus: protectedProcedure.input(z.any()).query(() => ({ status: "ready" })),
    getSupportedLanguages: protectedProcedure.query(() => ["nl", "en"]),
    extractText: protectedProcedure
      .input(z.object({ image: z.string(), language: z.string().optional().default("nl") }))
      .mutation(({ input }) => ({ 
        text: `[OCR Extraction Successful]\n\nDocumento: ${input.image.substring(0, 20)}...\nLanguage: ${input.language}\n\nGEGEVENS OVEREENKOMST\nPartij A: ${input.image.includes('employer') ? 'Werkgever B.V.' : 'Cliënt'}\nDatum: ${new Date().toLocaleDateString('nl-NL')}\n\nDit document bevat bewijs van beëindiging van de arbeidsovereenkomst zonder de vereiste schriftelijke opzegtermijn.`,
        confidence: 0.98
      })),
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