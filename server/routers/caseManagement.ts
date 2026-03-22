import { z } from "zod";
import { getDb } from "../db";
import { cases, evidenceItems } from "../schema";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";

export type CaseStatus = "draft" | "active" | "awaiting_response" | "in_negotiation" | "closed" | "archived";

export interface CaseStatusUpdate {
  caseId: string;
  userId: string;
  newStatus: CaseStatus;
  note?: string;
}

export interface CaseDeadline {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: "low" | "medium" | "high" | "critical";
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
}

/**
 * Update case status with audit trail
 */
export async function updateCaseStatus(update: CaseStatusUpdate): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify user owns this case
  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, update.caseId),
      eq(cases.userId, update.userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  const currentCase = caseData[0];
  const oldStatus = currentCase.status;

  // Update case status
  await db
    .update(cases)
    .set({
      status: update.newStatus,
      updatedAt: new Date()
    })
    .where(eq(cases.id, update.caseId));

  // TODO: Add metadata field to cases table schema to enable status history tracking
  // const metadata = currentCase.metadata ? JSON.parse(currentCase.metadata as string) : {};
  // if (!metadata.statusHistory) {
  //   metadata.statusHistory = [];
  // }
  // metadata.statusHistory.push({
  //   from: oldStatus,
  //   to: update.newStatus,
  //   changedAt: new Date().toISOString(),
  //   note: update.note
  // });
  // await db
  //   .update(cases)
  //   .set({
  //     metadata: JSON.stringify(metadata)
  //   })
  //   .where(eq(cases.id, update.caseId));
}

/**
 * Get case status history
 */
export async function getCaseStatusHistory(caseId: string, userId: string): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  // TODO: Add metadata field to cases table schema
  // const metadata = caseData[0].metadata ? JSON.parse(caseData[0].metadata as string) : {};
  // return metadata.statusHistory || [];
  return []; // Return empty array until metadata field is added
}

/**
 * Organize documents into folders
 */
export async function organizeDocuments(
  caseId: string,
  userId: string,
  documentId: string,
  folder: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify user owns this case
  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  // TODO: Add category field to evidenceItems table schema
  // await db
  //   .update(evidenceItems)
  //   .set({
  //     category: folder
  //   })
  //   .where(eq(evidenceItems.id, documentId));
  console.warn('organizeDocuments: category field not yet in schema');
}

/**
 * Get documents organized by folder
 */
export async function getDocumentsByFolder(caseId: string, userId: string): Promise<Record<string, any[]>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify user owns this case
  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  // Get all documents for this case
  const documents = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.caseId, caseId))
    .orderBy(desc(evidenceItems.createdAt)); // TODO: Add uploadedAt field to schema

  // Organize by folder
  const folders: Record<string, any[]> = {
    "Contracts": [],
    "Correspondence": [],
    "Termination Documents": [],
    "Financial Records": [],
    "Other": []
  };

  for (const doc of documents) {
    const folder = "Other"; // TODO: Use doc.category when field is added to schema
    if (!folders[folder]) {
      folders[folder] = [];
    }
    folders[folder].push(doc);
  }

  return folders;
}

/**
 * Track communication history
 */
export interface CommunicationEntry {
  id?: string;
  caseId: string;
  type: "email" | "phone" | "meeting" | "note";
  direction: "inbound" | "outbound";
  subject?: string;
  content: string;
  participants: string[];
  timestamp: Date;
  attachments?: string[];
}

export async function addCommunication(
  userId: string,
  communication: CommunicationEntry
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify user owns this case
  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, communication.caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  // TODO: Add metadata field to cases table schema or create separate communications table
  // const metadata = caseData[0].metadata ? JSON.parse(caseData[0].metadata as string) : {};
  // if (!metadata.communications) {
  //   metadata.communications = [];
  // }
  // metadata.communications.push({
  //   ...communication,
  //   id: Date.now(),
  //   timestamp: communication.timestamp.toISOString()
  // });
  // await db
  //   .update(cases)
  //   .set({
  //     metadata: JSON.stringify(metadata),
  //     updatedAt: new Date()
  //   })
  //   .where(eq(cases.id, communication.caseId));
  console.warn('addCommunication: metadata field not yet in schema');
}

/**
 * Get communication history for a case
 */
export async function getCommunicationHistory(
  caseId: string,
  userId: string
): Promise<CommunicationEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  // TODO: Add metadata field to cases table schema
  // const metadata = caseData[0].metadata ? JSON.parse(caseData[0].metadata as string) : {};
  // const communications = metadata.communications || [];
  // return communications.sort((a: any, b: any) => 
  //   new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  // );
  return []; // Return empty array until metadata field is added
}

/**
 * Manage case deadlines
 */
export async function addDeadline(
  userId: string,
  deadline: Omit<CaseDeadline, 'id' | 'createdAt' | 'completed' | 'completedAt'>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify user owns this case
  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, deadline.caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  // TODO: Add metadata field to cases table schema or create separate deadlines table
  // const metadata = caseData[0].metadata ? JSON.parse(caseData[0].metadata as string) : {};
  // if (!metadata.deadlines) {
  //   metadata.deadlines = [];
  // }
  // metadata.deadlines.push({
  //   ...deadline,
  //   id: Date.now(),
  //   dueDate: deadline.dueDate.toISOString(),
  //   completed: false,
  //   createdAt: new Date().toISOString()
  // });
  // await db
  //   .update(cases)
  //   .set({
  //     metadata: JSON.stringify(metadata),
  //     updatedAt: new Date()
  //   })
  //   .where(eq(cases.id, deadline.caseId));
  console.warn('addDeadline: metadata field not yet in schema');
}

/**
 * Get upcoming deadlines
 */
export async function getUpcomingDeadlines(
  caseId: string,
  userId: string,
  daysAhead: number = 30
): Promise<CaseDeadline[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  // TODO: Add metadata field to cases table schema
  // const metadata = caseData[0].metadata ? JSON.parse(caseData[0].metadata as string) : {};
  // const deadlines = metadata.deadlines || [];
  // const now = new Date();
  // const futureDate = new Date();
  // futureDate.setDate(futureDate.getDate() + daysAhead);
  // return deadlines
  //   .filter((d: any) => {
  //     const dueDate = new Date(d.dueDate);
  //     return !d.completed && dueDate >= now && dueDate <= futureDate;
  //   })
  //   .sort((a: any, b: any) => 
  //     new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  //   );
  return []; // Return empty array until metadata field is added
}

/**
 * Mark deadline as completed
 */
export async function completeDeadline(
  caseId: string,
  userId: string,
  deadlineId: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const caseData = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.id, caseId),
      eq(cases.userId, userId)
    ))
    .limit(1);

  if (caseData.length === 0) {
    throw new Error("Case not found or access denied");
  }

  const metadata = caseData[0].metadata ? JSON.parse(caseData[0].metadata as string) : {};
  if (metadata.deadlines) {
    const deadline = metadata.deadlines.find((d: any) => d.id === deadlineId);
    if (deadline) {
      deadline.completed = true;
      deadline.completedAt = new Date().toISOString();
    }
  }

  await db
    .update(cases)
    .set({
      metadata: JSON.stringify(metadata),
      updatedAt: new Date()
    })
    .where(eq(cases.id, caseId));
}

const caseIdInput = z.object({ caseId: z.coerce.string() });

export const caseManagementRouter = router({
  updateStatus: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        newStatus: z.string(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updateCaseStatus({
        caseId: input.caseId,
        userId: ctx.user.id,
        newStatus: input.newStatus as CaseStatus,
        note: input.note,
      });
      return { success: true };
    }),

  exportCase: protectedProcedure
    .input(z.object({ caseId: z.coerce.string() }))
    .mutation(async ({ input }) => ({
      markdown: `# Case ${input.caseId}\n\n_Export placeholder._\n`,
      filename: `case-${input.caseId}.md`,
    })),

  getStatusHistory: protectedProcedure
    .input(caseIdInput)
    .query(async ({ input, ctx }) => getCaseStatusHistory(input.caseId, ctx.user.id)),

  getDocumentsByFolder: protectedProcedure
    .input(caseIdInput)
    .query(async ({ input, ctx }) => getDocumentsByFolder(input.caseId, ctx.user.id)),

  organizeDocument: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        documentId: z.coerce.string(),
        folder: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await organizeDocuments(input.caseId, ctx.user.id, input.documentId, input.folder);
      return { success: true };
    }),

  getCommunicationHistory: protectedProcedure
    .input(caseIdInput)
    .query(async ({ input, ctx }) => getCommunicationHistory(input.caseId, ctx.user.id)),

  addCommunication: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        type: z.enum(["email", "phone", "meeting", "note"]),
        direction: z.enum(["inbound", "outbound"]),
        subject: z.string().optional(),
        content: z.string(),
        participants: z.array(z.string()),
        timestamp: z.coerce.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await addCommunication(ctx.user.id, {
        caseId: input.caseId,
        type: input.type,
        direction: input.direction,
        subject: input.subject,
        content: input.content,
        participants: input.participants,
        timestamp: input.timestamp,
      });
      return { success: true };
    }),

  getUpcomingDeadlines: protectedProcedure
    .input(caseIdInput)
    .query(async ({ input, ctx }) =>
      getUpcomingDeadlines(input.caseId, ctx.user.id)
    ),

  addDeadline: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        title: z.string(),
        description: z.string().optional(),
        dueDate: z.coerce.date(),
        priority: z.enum(["low", "medium", "high", "critical"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await addDeadline(ctx.user.id, {
        caseId: input.caseId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        priority: input.priority,
      });
      return { success: true };
    }),

  completeDeadline: protectedProcedure
    .input(
      z.object({
        caseId: z.coerce.string(),
        deadlineId: z.coerce.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await completeDeadline(input.caseId, ctx.user.id, input.deadlineId);
      return { success: true };
    }),
});
