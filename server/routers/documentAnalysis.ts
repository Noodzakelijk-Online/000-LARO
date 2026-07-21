import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { assertCaseOwnership } from "../_core/authz";
import { protectedProcedure, router } from "../_core/trpc";
import { analyzeStoredEvidence, parseDocumentAnalysisResult } from "../documentAnalysisService";
import { DOCUMENT_ANALYSIS_VERSION, supportedDocumentAnalysisMimeTypes } from "../documentIntelligence";
import { getDb } from "../db";
import { documentAnalyses, evidence, timeline as persistedTimeline } from "../schema";

function parseTimelineMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export const documentAnalysisRouter = router({
  capabilities: protectedProcedure.query(() => ({
    version: DOCUMENT_ANALYSIS_VERSION,
    localAnalysis: true,
    deepAnalysisConfigured: Boolean(process.env.FORGE_API_KEY),
    supportedMimeTypes: supportedDocumentAnalysisMimeTypes(),
    ocrAvailable: true,
    ocrLanguages: ["nld", "eng"],
    ocrProcessing: "local" as const,
  })),

  analyzeEvidence: protectedProcedure
    .input(z.object({
      evidenceId: z.string().min(1),
      deepAnalysis: z.boolean().default(true),
      force: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await analyzeStoredEvidence({ userId: ctx.user.id, ...input });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : "Document analysis failed";
        throw new TRPCError({
          code: message === "Evidence file not found" ? "NOT_FOUND" : "PRECONDITION_FAILED",
          message,
        });
      }
    }),

  byEvidence: protectedProcedure
    .input(z.object({ evidenceId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(documentAnalyses)
        .where(and(eq(documentAnalyses.evidenceId, input.evidenceId), eq(documentAnalyses.userId, ctx.user.id)))
        .orderBy(desc(documentAnalyses.updatedAt))
        .limit(1);
      return row ? { id: row.id, result: parseDocumentAnalysisResult(row.result), updatedAt: row.updatedAt } : null;
    }),

  generateCaseTimeline: protectedProcedure
    .input(z.object({ caseId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCaseOwnership(input.caseId, ctx.user.id);
      const db = await getDb();
      const [rows, persistedRows, evidenceRows] = await Promise.all([
        db
          .select({ analysis: documentAnalyses, evidenceTitle: evidence.title })
          .from(documentAnalyses)
          .innerJoin(evidence, eq(documentAnalyses.evidenceId, evidence.id))
          .where(and(eq(documentAnalyses.caseId, input.caseId), eq(documentAnalyses.userId, ctx.user.id)))
          .orderBy(asc(documentAnalyses.createdAt)),
        db
          .select()
          .from(persistedTimeline)
          .where(and(eq(persistedTimeline.caseId, input.caseId), eq(persistedTimeline.userId, ctx.user.id)))
          .orderBy(asc(persistedTimeline.eventAt)),
        db
          .select({ id: evidence.id, title: evidence.title })
          .from(evidence)
          .where(and(eq(evidence.caseId, input.caseId), eq(evidence.userId, ctx.user.id))),
      ]);

      const analyzedEvents = rows.flatMap(({ analysis, evidenceTitle }) => {
        const result = parseDocumentAnalysisResult(analysis.result);
        const citations = new Map(result.citations.map((citation) => [citation.id, citation]));
        return result.timelineEvents.map((event) => ({
          ...event,
          description: event.text,
          source: {
            evidenceId: analysis.evidenceId,
            title: evidenceTitle,
            citation: citations.get(event.citations[0]) ?? null,
          },
        }));
      });
      const evidenceTitles = new Map(evidenceRows.map((item) => [item.id, item.title]));
      const storedEvents = persistedRows.flatMap((event) => {
        const metadata = parseTimelineMetadata(event.metadata);
        const evidenceId = typeof metadata.evidenceId === "string" ? metadata.evidenceId : null;
        const evidenceTitle = evidenceId ? evidenceTitles.get(evidenceId) : null;
        if (!event.eventAt || !evidenceId || !evidenceTitle) return [];
        const legacySource = metadata.legacySource && typeof metadata.legacySource === "object"
          ? metadata.legacySource as Record<string, unknown>
          : {};
        return [{
          date: event.eventAt.toISOString().slice(0, 10),
          title: event.title || "Imported legal event",
          text: event.description || "",
          description: event.description || "",
          actor: typeof legacySource.actor === "string" ? legacySource.actor : null,
          importance: "medium" as const,
          category: "legal" as const,
          citations: [] as string[],
          source: { evidenceId, title: evidenceTitle, citation: null },
        }];
      });
      const uniqueEvents = new Map<string, (typeof analyzedEvents)[number] | (typeof storedEvents)[number]>();
      for (const event of [...analyzedEvents, ...storedEvents]) {
        const key = `${event.date}|${event.title.trim().toLowerCase()}|${event.source.evidenceId}`;
        if (!uniqueEvents.has(key)) uniqueEvents.set(key, event);
      }
      const events = [...uniqueEvents.values()].sort((left, right) => left.date.localeCompare(right.date));

      const parseTime = (value: string) => {
        const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        const time = Date.parse(value);
        return Number.isFinite(time) ? time : null;
      };
      const times = events.map((event) => parseTime(event.date)).filter((value): value is number => value !== null);
      const durationDays = times.length > 1 ? Math.ceil((Math.max(...times) - Math.min(...times)) / 86_400_000) : 0;
      return {
        events,
        duration_days: durationDays,
        key_dates: [...new Set(events.map((event) => event.date))],
        summary: events.length
          ? `${events.length} source-linked event${events.length === 1 ? "" : "s"} from ${new Set(events.map((event) => event.source.evidenceId)).size} document${new Set(events.map((event) => event.source.evidenceId)).size === 1 ? "" : "s"}.`
          : "No dated events are available. Analyze case documents first.",
        gaps: events.length === 0 ? ["No analyzed or imported source-linked events are available for this case."] : [],
      };
    }),
});
