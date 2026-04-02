/**
 * Outreach Packet Router — Step D of MVP
 * Generates: evidence export links + prefilled email template
 * referencing case summary + top timeline events
 */

import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { cases, evidence, timeline, outreachStatus } from '../schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const outreachPacketRouter = router({

  /**
   * Generate a complete outreach packet for a case + lawyer
   * Returns: prefilled email, case summary, top timeline events, export links
   */
  generate: publicProcedure
    .input(z.object({
      caseId:     z.string(),
      lawyerId:   z.string().optional(),
      lawyerName: z.string().optional(),
      lawyerEmail: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get case
      const caseResult = await db.select().from(cases)
        .where(and(eq(cases.id, input.caseId), eq(cases.userId, ctx.user.id)))
        .limit(1);
      if (!caseResult.length) throw new Error('Case not found');
      const caseData = caseResult[0];

      // Get evidence count
      const evidenceItems = await db.select().from(evidence)
        .where(and(eq(evidence.caseId, input.caseId), eq(evidence.userId, ctx.user.id)));

      // Get top timeline events (most recent 5)
      const timelineEvents = await db.select().from(timeline)
        .where(eq(timeline.caseId, input.caseId))
        .orderBy(desc(timeline.eventAt as any))
        .limit(5);

      // Build top timeline bullets
      const timelineBullets = timelineEvents
        .map(e => {
          const date = e.eventAt
            ? new Date(e.eventAt).toLocaleDateString('nl-NL')
            : 'Onbekende datum';
          return `• ${date}: ${e.title}`;
        })
        .join('\n');

      // Parse legal areas
      let legalAreas: string[] = [];
      try { legalAreas = JSON.parse(caseData.legalAreas ?? '[]'); } catch {}
      const legalAreaStr = legalAreas.length > 0
        ? legalAreas.join(', ')
        : caseData.caseType ?? 'Onbekend rechtsgebied';

      // Build prefilled email (Dutch)
      const lawyerName  = input.lawyerName  ?? 'Geachte advocaat';
      const lawyerEmail = input.lawyerEmail ?? '';
      const clientName  = caseData.clientName ?? ctx.user.name ?? 'Cliënt';

      const emailSubject = `Juridische bijstand gevraagd — ${caseData.caseType ?? 'Rechtszaak'} | ${clientName}`;

      const emailBody = `${lawyerName},

Ik schrijf u in verband met een juridische kwestie waarvoor ik professionele bijstand zoek.

**Zaaktype:** ${legalAreaStr}
**Urgentie:** ${caseData.urgency ?? 'Gemiddeld'}

**Situatiebeschrijving:**
${caseData.caseSummary ?? '(Geen samenvatting beschikbaar)'}

**Belangrijkste tijdlijn van gebeurtenissen:**
${timelineBullets || '• Zie bijgevoegde documentatie'}

**Bijgevoegde documentatie:**
${evidenceItems.length} document(en) beschikbaar voor inzage (${evidenceItems.length} bewijsstukken).

Ik heb alle relevante documentatie verzameld en ben bereid deze met u te delen.
Kunt u aangeven of u beschikbaar bent voor een eerste consultatie?

Met vriendelijke groet,
${clientName}
${ctx.user.email ?? ''}`;

      // Record outreach attempt in DB
      const outreachId = nanoid();
      if (input.lawyerId) {
        await db.insert(outreachStatus).values({
          id:       outreachId,
          caseId:   input.caseId,
          lawyerId: input.lawyerId,
          status:   'packet_generated',
          metadata: JSON.stringify({
            generatedAt:   new Date().toISOString(),
            lawyerName,
            lawyerEmail,
            evidenceCount: evidenceItems.length,
          }),
          updatedAt: new Date(),
        } as any);
      }

      return {
        success: true,
        packet: {
          email: {
            to:      lawyerEmail,
            subject: emailSubject,
            body:    emailBody,
          },
          caseSummary: {
            caseType:       caseData.caseType,
            legalAreas,
            urgency:        caseData.urgency,
            summary:        caseData.caseSummary,
            evidenceCount:  evidenceItems.length,
            timelineEvents: timelineEvents.length,
          },
          timelineBullets,
          exportLinks: {
            // These are tRPC endpoint URLs the frontend can call
            pdf:  `/api/trpc/evidenceExport.exportPDF?caseId=${input.caseId}`,
            csv:  `/api/trpc/evidenceExport.exportCSV?caseId=${input.caseId}`,
            zip:  `/api/trpc/evidenceExport.exportZIP?caseId=${input.caseId}`,
          },
          outreachId: input.lawyerId ? outreachId : null,
        },
      };
    }),

  /**
   * Get all outreach packets generated for a case
   */
  getHistory: publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return [];
      const db = await getDb();
      if (!db) return [];

      return await db.select().from(outreachStatus)
        .where(eq(outreachStatus.caseId, input.caseId))
        .orderBy(desc(outreachStatus.updatedAt));
    }),

  /**
   * Mark outreach as sent (after user copies/sends the email)
   */
  markSent: publicProcedure
    .input(z.object({
      outreachId: z.string(),
      sentVia:    z.enum(['email', 'copied', 'downloaded']).default('copied'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return { success: false };
      const db = await getDb();
      if (!db) return { success: false };

      await db.update(outreachStatus)
        .set({
          status:    'sent',
          updatedAt: new Date(),
          metadata:  JSON.stringify({ sentAt: new Date().toISOString(), sentVia: input.sentVia }),
        } as any)
        .where(eq(outreachStatus.id, input.outreachId));

      return { success: true };
    }),
});