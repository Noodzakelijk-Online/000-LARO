import { getDb } from "./db";
import { cases, documents, communications, deadlines, timeline } from "./schema";
import { eq, desc, asc } from "drizzle-orm";

interface CaseExportData {
  caseId: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
  documents: Array<{
    name: string | null;
    type: string | null;
    uploadedAt: Date | null;
  }>;
  communications: Array<{
    type: string | null;
    content: string | null;
    timestamp: Date | null;
  }>;
  deadlines: Array<{
    title: string | null;
    dueDate: Date | null;
    completed: boolean | null;
  }>;
  timeline: Array<{
    date: Date | null;
    event: string | null;
    description: string | null;
  }>;
}

export async function getCaseExportData(caseId: string): Promise<CaseExportData | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get case details
    const caseData = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    
    if (caseData.length === 0) {
      return null;
    }

    const c = caseData[0];

    // Get documents
    const docRows = await db.select({
      name: documents.name,
      type: documents.type,
      uploadedAt: documents.uploadedAt
    })
    .from(documents)
    .where(eq(documents.caseId, caseId))
    .orderBy(desc(documents.uploadedAt));

    // Get communications
    const commRows = await db.select({
      type: communications.type,
      content: communications.content,
      timestamp: communications.timestamp
    })
    .from(communications)
    .where(eq(communications.caseId, caseId))
    .orderBy(desc(communications.timestamp));

    // Get deadlines
    const deadlineRows = await db.select({
      title: deadlines.title,
      dueDate: deadlines.dueDate,
      completed: deadlines.completed
    })
    .from(deadlines)
    .where(eq(deadlines.caseId, caseId))
    .orderBy(asc(deadlines.dueDate));

    // Get timeline events
    const timelineRows = await db.select({
      date: timeline.eventAt,
      event: timeline.title,
      description: timeline.description
    })
    .from(timeline)
    .where(eq(timeline.caseId, caseId))
    .orderBy(asc(timeline.eventAt));

    return {
      caseId: c.id,
      title: c.clientName || 'Untitled Case',
      description: c.caseSummary || '',
      status: c.status || 'draft',
      createdAt: c.createdAt || new Date(),
      documents: docRows,
      communications: commRows,
      deadlines: deadlineRows,
      timeline: timelineRows
    };
  } catch (error) {
    console.error('[CaseExport] Error getting case data:', error);
    return null;
  }
}

export function generateCaseMarkdown(data: CaseExportData): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Case Report: ${data.title}`);
  lines.push('');
  lines.push(`**Case ID:** ${data.caseId}`);
  lines.push(`**Status:** ${data.status}`);
  lines.push(`**Created:** ${data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A'}`);
  lines.push('');

  // Description
  if (data.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(data.description);
    lines.push('');
  }

  // Timeline
  if (data.timeline.length > 0) {
    lines.push('## Timeline');
    lines.push('');
    data.timeline.forEach(event => {
      lines.push(`**${event.date ? new Date(event.date).toLocaleDateString() : 'Unknown'}** - ${event.event || 'No Event'}`);
      if (event.description) {
        lines.push(`  ${event.description}`);
      }
      lines.push('');
    });
  }

  // Documents
  if (data.documents.length > 0) {
    lines.push('## Documents');
    lines.push('');
    lines.push('| Document Name | Type | Uploaded |');
    lines.push('|---------------|------|----------|');
    data.documents.forEach(doc => {
      lines.push(`| ${doc.name || 'Unnamed'} | ${doc.type || 'N/A'} | ${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'} |`);
    });
    lines.push('');
  }

  // Deadlines
  if (data.deadlines.length > 0) {
    lines.push('## Deadlines');
    lines.push('');
    data.deadlines.forEach(deadline => {
      const status = deadline.completed ? '✅' : '⏳';
      lines.push(`${status} **${deadline.title || 'Untitled'}** - Due: ${deadline.dueDate ? new Date(deadline.dueDate).toLocaleDateString() : 'N/A'}`);
    });
    lines.push('');
  }

  // Communications
  if (data.communications.length > 0) {
    lines.push('## Communications');
    lines.push('');
    data.communications.forEach(comm => {
      lines.push(`### ${comm.type || 'Communication'} - ${comm.timestamp ? new Date(comm.timestamp).toLocaleDateString() : 'N/A'}`);
      lines.push('');
      lines.push(comm.content || 'No content');
      lines.push('');
    });
  }

  // Footer
  lines.push('---');
  lines.push(`*Report generated on ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

export async function exportCaseToMarkdown(caseId: string): Promise<string | null> {
  const data = await getCaseExportData(caseId);
  if (!data) return null;
  
  return generateCaseMarkdown(data);
}

