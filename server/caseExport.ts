import { getDb } from "./db";

interface CaseExportData {
  caseId: number;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
  documents: Array<{
    name: string;
    type: string;
    uploadedAt: Date;
  }>;
  communications: Array<{
    type: string;
    content: string;
    timestamp: Date;
  }>;
  deadlines: Array<{
    title: string;
    dueDate: Date;
    completed: boolean;
  }>;
  timeline: Array<{
    date: Date;
    event: string;
    description: string;
  }>;
}

export async function getCaseExportData(caseId: number): Promise<CaseExportData | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get case details
    const [caseRows] = await db.execute(
      'SELECT * FROM cases WHERE id = ?',
      [caseId]
    );
    
    if (!Array.isArray(caseRows) || caseRows.length === 0) {
      return null;
    }

    const caseData = caseRows[0] as any;

    // Get documents
    const [docRows] = await db.execute(
      'SELECT name, type, uploadedAt FROM documents WHERE caseId = ? ORDER BY uploadedAt DESC',
      [caseId]
    );

    // Get communications
    const [commRows] = await db.execute(
      'SELECT type, content, timestamp FROM communications WHERE caseId = ? ORDER BY timestamp DESC',
      [caseId]
    );

    // Get deadlines
    const [deadlineRows] = await db.execute(
      'SELECT title, dueDate, completed FROM deadlines WHERE caseId = ? ORDER BY dueDate ASC',
      [caseId]
    );

    // Get timeline events
    const [timelineRows] = await db.execute(
      'SELECT date, event, description FROM timeline WHERE caseId = ? ORDER BY date ASC',
      [caseId]
    );

    return {
      caseId: caseData.id,
      title: caseData.title || 'Untitled Case',
      description: caseData.description || '',
      status: caseData.status || 'draft',
      createdAt: caseData.createdAt,
      documents: Array.isArray(docRows) ? docRows as any[] : [],
      communications: Array.isArray(commRows) ? commRows as any[] : [],
      deadlines: Array.isArray(deadlineRows) ? deadlineRows as any[] : [],
      timeline: Array.isArray(timelineRows) ? timelineRows as any[] : []
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
  lines.push(`**Created:** ${new Date(data.createdAt).toLocaleDateString()}`);
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
      lines.push(`**${new Date(event.date).toLocaleDateString()}** - ${event.event}`);
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
      lines.push(`| ${doc.name} | ${doc.type} | ${new Date(doc.uploadedAt).toLocaleDateString()} |`);
    });
    lines.push('');
  }

  // Deadlines
  if (data.deadlines.length > 0) {
    lines.push('## Deadlines');
    lines.push('');
    data.deadlines.forEach(deadline => {
      const status = deadline.completed ? '✅' : '⏳';
      lines.push(`${status} **${deadline.title}** - Due: ${new Date(deadline.dueDate).toLocaleDateString()}`);
    });
    lines.push('');
  }

  // Communications
  if (data.communications.length > 0) {
    lines.push('## Communications');
    lines.push('');
    data.communications.forEach(comm => {
      lines.push(`### ${comm.type} - ${new Date(comm.timestamp).toLocaleDateString()}`);
      lines.push('');
      lines.push(comm.content);
      lines.push('');
    });
  }

  // Footer
  lines.push('---');
  lines.push(`*Report generated on ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

export async function exportCaseToMarkdown(caseId: number): Promise<string | null> {
  const data = await getCaseExportData(caseId);
  if (!data) return null;
  
  return generateCaseMarkdown(data);
}

