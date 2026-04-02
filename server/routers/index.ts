import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../cookies";
import { systemRouter } from '../_core/systemRouter';
import { publicProcedure, router } from '../_core/trpc';
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
import { z } from "zod";

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




  // Auth procedures
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Clarifications procedures
  clarifications: router({
    pending: publicProcedure.query(() => []),
  }),
  
  // OCR procedures (placeholder for now)
  ocr: router({
    supportsOcr: publicProcedure.input(z.any()).query(() => true),
    getStatus: publicProcedure.input(z.any()).query(() => ({ status: "ready" })),
    getSupportedLanguages: publicProcedure.query(() => ["nl", "en"]),
    extractText: publicProcedure.mutation(() => ({ text: "Extracted text placeholder" })),
  }),

  // Analytics procedures
  analytics: router({
    getOverallStats: publicProcedure.query(() => ({})),
    getOutreachTrends: publicProcedure.query(() => []),
    getLawyerPerformance: publicProcedure.query(() => []),
    getLegalAreaDistribution: publicProcedure.query(() => []),
    getLawyerCapacity: publicProcedure.query(() => []),
    getCaseDistribution: publicProcedure.query(() => []),
    getWorkloadMetrics: publicProcedure.query(() => []),
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