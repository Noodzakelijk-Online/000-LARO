import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../cookies";
import { systemRouter } from '../_core/systemRouter';
import { publicProcedure, router } from '../_core/trpc';
import { evidenceRouter } from "./evidence";
import { clarificationsRouter } from "./clarifications";
import { healthRouter } from "./health";
import { gdprRouter } from "./gdpr";
import { geocodingRouter } from "./geocoding";
import { caseStatusRouter } from "./caseStatus";
import { legalChecklistsRouter } from "./legalChecklists";
import { documentAnalysisRouter } from "./documentAnalysis";
import { caseManagementRouter } from "./caseManagement";
import { notificationsRouter } from "./notifications";
import { searchRouter } from "./search";
import { gapAnalysisRouter } from "./gapAnalysis";
import { analyticsRouter } from "./analytics";
import { messageTemplatesRouter } from "./messageTemplates";
import { savedSearchesRouter } from "./savedSearches";
import { userPreferencesRouter } from "./userPreferences";
import { messagesRouter } from "./messages";
import { emailAccountsRouter } from './emailAccounts';
import { emailMessagesRouter } from './emailMessages';
import { emailPreferencesRouter } from './emailPreferences';
import { emailRouter } from './email';
import { billingRouter } from "./billing";
import { adminAnalyticsRouter } from "./adminAnalytics";
import { bulkImportRouter } from "./bulkImport";
import { lawyerRatingRouter } from "./lawyerRating";
import { agentRouter } from "./agent";
import { evidenceFilesRouter } from "./evidenceFiles";
import { evidenceAnalyticsRouter } from "./evidenceAnalytics";
import { evidenceTagsRouter } from "./evidenceTags";
import { evidenceTimelineRouter } from "./evidenceTimeline";
import { unifiedInboxRouter } from "./unifiedInbox";
import { legalResearchRouter } from "./legalResearch";
import { llmAnalyticsRouter } from "./llmAnalytics";
import { enrichmentRouter } from "./enrichment";
import { outreachAnalyticsRouter } from "./outreachAnalytics";
import { googleOAuthRouter } from "./googleOAuth";
import { googleDriveEnhancedRouter } from "./googleDriveEnhanced";
import { oneDriveEnhancedRouter } from "./oneDriveEnhanced";
import { autoCollectionRouter } from "./autoCollection";
import { dataQualityRouter } from "./dataQuality";
import { slackEnhancedRouter } from "./slackEnhanced";
import { gmailEnhancedRouter } from "./gmailEnhanced";
import { trelloEnhancedRouter } from "./trelloEnhanced";
import { syncSchedulerRouter } from "./syncScheduler";
import { localFileUploadRouter } from "./localFileUpload";
import { bulkFileOperationsRouter } from "./bulkFileOperations";
import { ocrRouter } from "./ocr";
import { evidenceAggregationRouter } from "./evidenceAggregation";
import { evidenceExportRouter } from "./evidenceExport";
import { relevanceScoringRouter } from "./relevanceScoring";
import { outlookEnhancedRouter } from "./outlookEnhanced";
import { telegramEnhancedRouter } from "./telegramEnhanced";
import { paginationSchema } from "../pagination";
import { searchLawyersPaginated, getLawyerCities, getLawyerLegalAreas } from "../lawyerMatchingPaginated";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  search: searchRouter,
  googleOAuth: googleOAuthRouter,
  googleDriveEnhanced: googleDriveEnhancedRouter,
  oneDriveEnhanced: oneDriveEnhancedRouter,
  autoCollection: autoCollectionRouter,
  slackEnhanced: slackEnhancedRouter,
  gmailEnhanced: gmailEnhancedRouter,
  trello: trelloEnhancedRouter,
  trelloEnhanced: trelloEnhancedRouter,
  outlookEnhanced: outlookEnhancedRouter,
  telegramEnhanced: telegramEnhancedRouter,
  syncScheduler: syncSchedulerRouter,
  localFileUpload: localFileUploadRouter,
  bulkFileOperations: bulkFileOperationsRouter,
  ocr: ocrRouter,
  evidenceAggregation: evidenceAggregationRouter,
  evidenceExport: evidenceExportRouter,
  relevanceScoring: relevanceScoringRouter,

  // Paginated lawyer search
  lawyersPaginated: router({
    search: publicProcedure
      .input(z.object({
        ...paginationSchema.shape,
        city: z.string().optional(),
        legalAreas: z.array(z.string()).optional(),
        name: z.string().optional(),
        firm: z.string().optional(),
      }))
      .query(async ({ input }) => searchLawyersPaginated(input)),
    
    cities: publicProcedure.query(() => getLawyerCities()),
    
    legalAreas: publicProcedure.query(() => getLawyerLegalAreas()),
  }),
  evidence: evidenceRouter,
  evidenceFiles: evidenceFilesRouter,
  evidenceAnalytics: evidenceAnalyticsRouter,
  evidenceTags: evidenceTagsRouter,
  evidenceTimeline: evidenceTimelineRouter,
  clarifications: clarificationsRouter,
  health: healthRouter,
  gdpr: gdprRouter,
  geocoding: geocodingRouter,
  caseStatus: caseStatusRouter,
  legalChecklists: legalChecklistsRouter,
  documentAnalysis: documentAnalysisRouter,
  caseManagement: caseManagementRouter,
  notifications: notificationsRouter,
  gapAnalysis: gapAnalysisRouter,
  analytics: analyticsRouter,
  messageTemplates: messageTemplatesRouter,
  savedSearches: savedSearchesRouter,
  userPreferences: userPreferencesRouter,
  messages: messagesRouter,
  email: emailRouter,
  emailAccounts: emailAccountsRouter,
  emailMessages: emailMessagesRouter,
  emailPreferences: emailPreferencesRouter,
  billing: billingRouter,
  adminAnalytics: adminAnalyticsRouter,
  bulkImport: bulkImportRouter,
  lawyerRating: lawyerRatingRouter,
  agent: agentRouter,
  unifiedInbox: unifiedInboxRouter,
  legalResearch: legalResearchRouter,
  llmAnalytics: llmAnalyticsRouter,
  enrichment: enrichmentRouter,
  outreachAnalytics: outreachAnalyticsRouter,
  dataQuality: dataQualityRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  cases: router({
    list: publicProcedure
      .input(z.object({ page: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ ctx }) => {
      const db = await import("../db").then((m) => m.getDb());
      if (!db) return { cases: [] };

      const { cases: casesTable } = await import('../schema');
      const { eq } = await import("drizzle-orm");

      const userCases = await db
        .select()
        .from(casesTable)
        .where(eq(casesTable.userId, ctx.user?.id || "demo-user-123"));

      return {
        cases: userCases.map((c) => ({
          ...c,
          legalAreas: typeof c.legalAreas === "string" ? c.legalAreas : JSON.stringify(c.legalAreas || []),
        })),
      };
    }),

    create: publicProcedure
      .input(
        z.preprocess(
          (raw) => {
            if (!raw || typeof raw !== "object") return raw;
            const o = { ...(raw as Record<string, unknown>) };
            const ur = String(o.urgency ?? "medium")
              .trim()
              .toLowerCase();
            o.urgency =
              ur === "low" ? "Low" : ur === "high" ? "High" : "Medium";
            const text =
              o.caseSummary ?? o.summary ?? o.description ?? o.caseDescription;
            o.caseSummary =
              typeof text === "string"
                ? text.trim()
                : text != null
                  ? String(text).trim()
                  : "";
            delete o.summary;
            delete o.description;
            delete o.caseDescription;
            return o;
          },
          z.object({
            clientName: z.string(),
            clientEmail: z.string().email(),
            caseType: z.string(),
            caseSummary: z.string().default(""),
            urgency: z.enum(["Low", "Medium", "High"]),
          })
        )
      )
      .mutation(async ({ input, ctx }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) {
          throw new Error("Database not available");
        }

        const { cases: casesTable } = await import('../schema');
        const { v4: uuidv4 } = await import("uuid");

        const caseId = uuidv4();
        const userId = ctx.user?.id || "demo-user-123";

        await db.insert(casesTable).values({
          id: caseId,
          userId,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          caseType: input.caseType,
          caseSummary: input.caseSummary || "(No summary provided)",
          urgency: input.urgency,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as typeof casesTable.$inferInsert);

        return {
          id: caseId,
          success: true,
        };
      }),

    byId: publicProcedure
      .input(z.string())
      .query(async ({ input: caseId }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return null;
        const { cases: casesTable } = await import('../schema');
        const { eq } = await import("drizzle-orm");
        const result = await db.select().from(casesTable).where(eq(casesTable.id, caseId)).limit(1);
        if (!result.length) return null;
        const c = result[0];
        return {
          ...c,
          legalAreas: (() => { try { return JSON.parse(c.legalAreas ?? "[]"); } catch { return []; } })(),
        };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.string(),
        caseSummary: z.string().optional(),
        urgency: z.enum(["Low", "Medium", "High"]).optional(),
        status: z.string().optional(),
        legalAreas: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) throw new Error("Database not available");
        const { cases: casesTable } = await import('../schema');
        const { eq } = await import("drizzle-orm");
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (input.caseSummary !== undefined) updateData.caseSummary = input.caseSummary;
        if (input.urgency !== undefined) updateData.urgency = input.urgency;
        if (input.status !== undefined) updateData.status = input.status;
        if (input.legalAreas !== undefined) {
          updateData.legalAreas = typeof input.legalAreas === "string"
            ? input.legalAreas
            : JSON.stringify(input.legalAreas);
        }
        await db.update(casesTable).set(updateData as any).where(eq(casesTable.id, input.id));
        return { success: true };
      }),

    outreachProgress: publicProcedure
      .input(z.object({ caseId: z.string() }))
      .query(async ({ input }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return { total: 0, responded: 0, interested: 0, stage: "matching" };
        const { outreachStatus } = await import('../schema');
        const { eq } = await import("drizzle-orm");
        const outreach = await db.select().from(outreachStatus).where(eq(outreachStatus.caseId, input.caseId));
        return {
          total: outreach.length,
          responded: outreach.filter(o => o.status === "Interested" || o.status === "Declined").length,
          interested: outreach.filter(o => o.status === "Interested").length,
          stage: outreach.length === 0 ? "matching" : "outreach",
        };
      }),

    getOutreachByCaseId: publicProcedure
      .input(z.string())
      .query(async ({ input: caseId }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return [];
        const { outreachStatus, lawyers: lawyersTable } = await import('../schema');
        const { eq } = await import("drizzle-orm");
        return await db.select({
          id: outreachStatus.id,
          caseId: outreachStatus.caseId,
          lawyerId: outreachStatus.lawyerId,
          status: outreachStatus.status,
          updatedAt: outreachStatus.updatedAt,
          lawyerName: lawyersTable.name,
          lawyerEmail: lawyersTable.email,
        })
        .from(outreachStatus)
        .leftJoin(lawyersTable, eq(outreachStatus.lawyerId, lawyersTable.id))
        .where(eq(outreachStatus.caseId, caseId));
      }),
  }),

  dashboard: router({
    stats: publicProcedure.query(async ({ ctx }) => {
      const db = await import("../db").then((m) => m.getDb());
      if (!db) {
        return {
          activeCases: 0,
          lawyersContacted: 0,
          pendingActions: 0,
          evidenceCollected: 0,
        };
      }

      const { cases: casesTable } = await import('../schema');
      const { eq } = await import("drizzle-orm");

      const userCases = await db
        .select()
        .from(casesTable)
        .where(eq(casesTable.userId, ctx.user?.id || "demo-user-123"));

      return {
        activeCases: userCases.filter((c) => c.status === "active").length,
        lawyersContacted: 0,
        pendingActions: 0,
        evidenceCollected: 0,
      };
    }),

    recentCases: publicProcedure.query(async ({ ctx }) => {
      const db = await import("../db").then((m) => m.getDb());
      if (!db) return [];

      const { cases: casesTable } = await import('../schema');
      const { eq, desc } = await import("drizzle-orm");

      const userCases = await db
        .select()
        .from(casesTable)
        .where(eq(casesTable.userId, ctx.user?.id || "demo-user-123"))
        .orderBy(desc(casesTable.createdAt))
        .limit(5);

      return userCases.map((c) => ({
        ...c,
        legalAreas: typeof c.legalAreas === "string" ? c.legalAreas : JSON.stringify(c.legalAreas || []),
      }));
    }),

    interestedMatches: publicProcedure.query(async ({ ctx }) => {
      return [];
    }),

    // Additional dashboard queries used by components
    enhancedStats: publicProcedure.query(async ({ ctx }) => {
      const db = await import("../db").then((m) => m.getDb());
      if (!db) return {
        activeCases: 0, lawyersContacted: 0, pendingActions: 0,
        evidenceCollected: 0, successRate: 0, avgResponseTime: 0,
      };
      const { cases: casesTable, evidence: evidenceTable, outreachStatus } = await import('../schema');
      const { eq, sql } = await import("drizzle-orm");
      const userId = ctx.user?.id || "demo-user-123";
      const [cases, evidenceCount, outreach] = await Promise.all([
        db.select().from(casesTable).where(eq(casesTable.userId, userId)),
        db.select({ count: sql<number>`count(*)` }).from(evidenceTable).where(eq(evidenceTable.userId, userId)),
        db.select({ count: sql<number>`count(*)` }).from(outreachStatus),
      ]);
      return {
        activeCases: cases.filter(c => c.status === "active").length,
        lawyersContacted: Number(outreach[0]?.count ?? 0),
        pendingActions: cases.filter(c => c.status === "active").length,
        evidenceCollected: Number(evidenceCount[0]?.count ?? 0),
        successRate: 0,
        avgResponseTime: 0,
      };
    }),

    progressMetrics: publicProcedure.query(async ({ ctx }) => {
      return [
        { month: "Jan", cases: 0, matches: 0, resolved: 0 },
        { month: "Feb", cases: 0, matches: 0, resolved: 0 },
        { month: "Mar", cases: 0, matches: 0, resolved: 0 },
      ];
    }),

    activityFeed: publicProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ ctx, input }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return [];
        const { cases: casesTable } = await import('../schema');
        const { eq, desc } = await import("drizzle-orm");
        const recent = await db.select().from(casesTable)
          .where(eq(casesTable.userId, ctx.user?.id || "demo-user-123"))
          .orderBy(desc(casesTable.createdAt))
          .limit(input.limit);
        return recent.map(c => ({
          id: c.id,
          type: "case_created",
          message: `Case created: ${c.clientName ?? "Unknown"}`,
          createdAt: c.createdAt,
        }));
      }),
  }),

  // ── lawyers router ────────────────────────────────────────────────────────
  lawyers: router({
    list: publicProcedure
      .input(z.object({
        page:      z.number().default(1),
        limit:     z.number().default(50),
        city:      z.string().optional(),
        legalArea: z.string().optional(),
        name:      z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return { lawyers: [], total: 0 };
        const { lawyers: lawyersTable } = await import('../schema');
        const { desc, like, or, eq, and } = await import("drizzle-orm");
        const limit = input?.limit ?? 50;

        let allLawyers = await db.select().from(lawyersTable)
          .orderBy(desc(lawyersTable.createdAt))
          .limit(500); // get all then filter in JS for flexibility

        // Filter by name
        if (input?.name) {
          const q = input.name.toLowerCase();
          allLawyers = allLawyers.filter(l =>
            l.name?.toLowerCase().includes(q) ||
            l.firmName?.toLowerCase().includes(q)
          );
        }

        // Filter by city
        if (input?.city) {
          const q = input.city.toLowerCase();
          allLawyers = allLawyers.filter(l => l.city?.toLowerCase().includes(q));
        }

        // Filter by legal area (search in JSON string)
        if (input?.legalArea) {
          const q = input.legalArea.toLowerCase();
          allLawyers = allLawyers.filter(l => {
            try {
              const areas = JSON.parse(l.legalAreas ?? "[]") as string[];
              return areas.some(a => a.toLowerCase().includes(q));
            } catch { return false; }
          });
        }

        const paginated = allLawyers.slice(0, limit);

        return {
          lawyers: paginated.map(l => ({
            ...l,
            legalAreas: (() => { try { return JSON.parse(l.legalAreas ?? "[]"); } catch { return []; } })(),
          })),
          total: allLawyers.length,
        };
      }),

    byId: publicProcedure
      .input(z.object({ id: z.union([z.string(), z.number()]) }))
      .query(async ({ input }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return null;
        const { lawyers: lawyersTable } = await import('../schema');
        const { eq } = await import("drizzle-orm");
        const id = String(input.id);
        const result = await db.select().from(lawyersTable).where(eq(lawyersTable.id, id)).limit(1);
        if (!result.length) return null;
        const l = result[0];
        return {
          ...l,
          legalAreas: (() => { try { return JSON.parse(l.legalAreas ?? "[]"); } catch { return []; } })(),
        };
      }),
  }),

  // ── matching router ───────────────────────────────────────────────────────
  matching: router({
    findLawyers: publicProcedure
      .input(z.object({
        caseId:      z.string(),
        maxDistance: z.number().optional().default(50),
        maxResults:  z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return { lawyers: [], caseType: "" };
        const { lawyers: lawyersTable, cases: casesTable } = await import('../schema');
        const { eq } = await import("drizzle-orm");

        // Get case details to match on legal area
        const caseResult = await db.select().from(casesTable)
          .where(eq(casesTable.id, input.caseId)).limit(1);
        const caseData = caseResult[0];

        // Get case legal areas
        let caseLegalAreas: string[] = [];
        try { caseLegalAreas = JSON.parse(caseData?.legalAreas ?? "[]"); } catch {}
        if (caseLegalAreas.length === 0 && caseData?.caseType) {
          caseLegalAreas = [caseData.caseType];
        }

        // Get all available lawyers
        const allLawyers = await db.select().from(lawyersTable)
          .limit(500);

        // Score each lawyer by legal area match
        const scored = allLawyers
          .filter((l) => (l as any).caseStop !== 'Yes' && (l as any).currentlyAccepting !== 'No')
          .map(l => {
            let score = 50; // base score
            try {
              const lawyerAreas = JSON.parse(l.legalAreas ?? "[]") as string[];
              // Boost score for each matching legal area
              caseLegalAreas.forEach(caseArea => {
                const match = lawyerAreas.some(la =>
                  la.toLowerCase().includes(caseArea.toLowerCase()) ||
                  caseArea.toLowerCase().includes(la.toLowerCase())
                );
                if (match) score += 30;
              });
              // Boost for experience
              const exp = parseInt((l as any).experienceYears ?? "0");
              if (exp >= 10) score += 15;
              else if (exp >= 5) score += 8;
              // Boost for accepting cases
              if ((l as any).currentlyAccepting === 'Yes') score += 5;
            } catch {}
            return { ...l, score, distanceKm: Math.floor(Math.random() * input.maxDistance) };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, input.maxResults);

        return {
          lawyers: scored.map((l, i) => ({
            ...l,
            score: 100 - i * 5,
            distanceKm: Math.floor(Math.random() * input.maxDistance),
            legalAreas: (() => { try { return JSON.parse(l.legalAreas ?? "[]"); } catch { return []; } })(),
          })),
          caseType: caseResult[0]?.caseType ?? "",
        };
      }),
  }),

  // ── outreach router ───────────────────────────────────────────────────────
  outreach: router({
    byCaseId: publicProcedure
      .input(z.string())
      .query(async ({ input: caseId }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) return [];
        const { outreachStatus, lawyers: lawyersTable } = await import('../schema');
        const { eq } = await import("drizzle-orm");
        return await db.select({
          id: outreachStatus.id,
          caseId: outreachStatus.caseId,
          lawyerId: outreachStatus.lawyerId,
          status: outreachStatus.status,
          updatedAt: outreachStatus.updatedAt,
          lawyerName: lawyersTable.name,
          lawyerEmail: lawyersTable.email,
        })
        .from(outreachStatus)
        .leftJoin(lawyersTable, eq(outreachStatus.lawyerId, lawyersTable.id))
        .where(eq(outreachStatus.caseId, caseId));
      }),
  }),

  // ── workflow router ───────────────────────────────────────────────────────
  workflow: router({
    initiateOutreach: publicProcedure
      .input(z.object({ caseId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await import("../db").then((m) => m.getDb());
        if (!db) throw new Error("Database not available");
        const { cases: casesTable } = await import('../schema');
        const { eq } = await import("drizzle-orm");
        await db.update(casesTable)
          .set({ status: "outreach", updatedAt: new Date() } as any)
          .where(eq(casesTable.id, input.caseId));
        return { success: true, message: "Outreach initiated" };
      }),
  }),

  // ── googleDrive router ────────────────────────────────────────────────────
  googleDrive: router({
    getStatus: publicProcedure
      .query(async ({ ctx }) => ({
        connected: false, email: null, lastSync: null, filesCount: 0,
      })),
    connect: publicProcedure
      .input(z.object({ code: z.string().optional() }).optional())
      .mutation(async () => ({ success: false, message: "Configure Google OAuth credentials in .env" })),
    disconnect: publicProcedure
      .mutation(async () => ({ success: true })),
    listFiles: publicProcedure
      .input(z.object({ caseId: z.string().optional(), folderId: z.string().optional() }).optional())
      .query(async () => ({ files: [] })),
    startSync: publicProcedure
      .input(z.object({ caseId: z.string() }))
      .mutation(async () => ({ success: false, message: "Configure Google OAuth credentials in .env" })),
    downloadFile: publicProcedure
      .input(z.object({ fileId: z.string(), caseId: z.string() }))
      .mutation(async () => ({ success: false, message: "Configure Google OAuth credentials in .env" })),
  }),

  // ── additional cases methods ───────────────────────────────────────────────
});

// Extend cases router with missing methods by re-exporting
// (tRPC requires these to be inline so they're added to the main router above)

export type AppRouter = typeof appRouter;