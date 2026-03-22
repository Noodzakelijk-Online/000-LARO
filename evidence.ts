import { eq, and, like, gte, lte, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { evidenceFiles, InsertEvidenceFile } from "../../drizzle/schema";
import { nanoid } from "nanoid";

export interface EvidenceSearchParams {
  userId: string;
  query?: string;
  fileType?: "all" | "document" | "image" | "video" | "audio" | "email" | "other";
  uploadSource?: "all" | "manual" | "agent";
  caseId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface EvidenceSearchResult {
  files: typeof evidenceFiles.$inferSelect[];
  total: number;
  hasMore: boolean;
}

/**
 * Search evidence files with filters and pagination
 */
export async function searchEvidenceFiles(
  params: EvidenceSearchParams
): Promise<EvidenceSearchResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const {
    userId,
    query,
    fileType,
    uploadSource,
    caseId,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = params;

  // Build WHERE conditions
  const conditions = [eq(evidenceFiles.userId, userId)];

  if (query) {
    conditions.push(like(evidenceFiles.fileName, `%${query}%`));
  }

  if (fileType && fileType !== "all") {
    conditions.push(eq(evidenceFiles.fileType, fileType));
  }

  if (uploadSource && uploadSource !== "all") {
    conditions.push(eq(evidenceFiles.uploadSource, uploadSource));
  }

  if (caseId) {
    conditions.push(eq(evidenceFiles.caseId, caseId));
  }

  if (dateFrom) {
    conditions.push(gte(evidenceFiles.uploadedAt, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(evidenceFiles.uploadedAt, dateTo));
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(evidenceFiles)
    .where(and(...conditions));

  const total = Number(countResult[0]?.count || 0);

  // Get paginated results
  const files = await db
    .select()
    .from(evidenceFiles)
    .where(and(...conditions))
    .orderBy(desc(evidenceFiles.uploadedAt))
    .limit(limit)
    .offset(offset);

  return {
    files,
    total,
    hasMore: offset + files.length < total,
  };
}

/**
 * Get evidence file by ID
 */
export async function getEvidenceFile(id: string, userId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(evidenceFiles)
    .where(and(eq(evidenceFiles.id, id), eq(evidenceFiles.userId, userId)))
    .limit(1);

  return result[0];
}

/**
 * Create evidence file record
 */
export async function createEvidenceFile(data: Omit<InsertEvidenceFile, "id">) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const id = nanoid();
  await db.insert(evidenceFiles).values({
    id,
    ...data,
  });

  return getEvidenceFile(id, data.userId);
}

/**
 * Delete evidence file
 */
export async function deleteEvidenceFile(id: string, userId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .delete(evidenceFiles)
    .where(and(eq(evidenceFiles.id, id), eq(evidenceFiles.userId, userId)));

  return { success: true };
}

/**
 * Get evidence files by case
 */
export async function getEvidenceFilesByCase(caseId: string, userId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(evidenceFiles)
    .where(and(eq(evidenceFiles.caseId, caseId), eq(evidenceFiles.userId, userId)))
    .orderBy(desc(evidenceFiles.uploadedAt));
}

/**
 * Get evidence file statistics for a user
 */
export async function getEvidenceStats(userId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select({
      totalFiles: sql<number>`count(*)`,
      totalSize: sql<string>`sum(CAST(${evidenceFiles.fileSize} AS UNSIGNED))`,
      documentCount: sql<number>`sum(case when ${evidenceFiles.fileType} = 'document' then 1 else 0 end)`,
      imageCount: sql<number>`sum(case when ${evidenceFiles.fileType} = 'image' then 1 else 0 end)`,
      videoCount: sql<number>`sum(case when ${evidenceFiles.fileType} = 'video' then 1 else 0 end)`,
      emailCount: sql<number>`sum(case when ${evidenceFiles.fileType} = 'email' then 1 else 0 end)`,
      manualCount: sql<number>`sum(case when ${evidenceFiles.uploadSource} = 'manual' then 1 else 0 end)`,
      agentCount: sql<number>`sum(case when ${evidenceFiles.uploadSource} = 'agent' then 1 else 0 end)`,
    })
    .from(evidenceFiles)
    .where(eq(evidenceFiles.userId, userId));

  return result[0] || {
    totalFiles: 0,
    totalSize: "0",
    documentCount: 0,
    imageCount: 0,
    videoCount: 0,
    emailCount: 0,
    manualCount: 0,
    agentCount: 0,
  };
}
