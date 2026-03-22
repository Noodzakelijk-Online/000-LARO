import { getDb } from "./db";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { evidence } from "./schema";

/**
 * Service to query evidence from all connected sources
 * Aggregates data from Gmail, Outlook, Google Drive, OneDrive, Slack, Trello, Telegram, and manual uploads
 */

interface EvidenceItem {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  source: string;
  type: string;
  content?: string;
  timestamp: Date;
  relevance: boolean;
  relevanceScore?: number;
  size?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface EvidenceStats {
  totalItems: number;
  relevantItems: number;
  irrelevantItems: number;
  avgRelevanceScore: number;
  collectionRate: number;
  sourceBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  dailyCollectionTrend: Array<{ date: string; count: number }>;
  sourceQuality: Array<{ source: string; quality: number }>;
  lastUpdated: Date;
}

/**
 * Fetch all evidence for a case from all sources
 */
export async function getAllEvidenceForCase(
  caseId: string,
  options?: {
    limit?: number;
    offset?: number;
    source?: string;
    relevanceFilter?: "all" | "relevant" | "irrelevant";
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<{ items: EvidenceItem[]; total: number }> {
  const db = await getDb();
  if (!db) {
    return { items: [], total: 0 };
  }

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // Build query filters
    const filters = [eq(evidence.caseId, caseId)];

    if (options?.source) {
      filters.push(eq(evidence.source, options.source));
    }

    if (options?.relevanceFilter === "relevant") {
      filters.push(eq(evidence.relevant, true));
    } else if (options?.relevanceFilter === "irrelevant") {
      filters.push(eq(evidence.relevant, false));
    }

    if (options?.dateFrom) {
      filters.push(gte(evidence.createdAt, options.dateFrom));
    }

    if (options?.dateTo) {
      filters.push(lte(evidence.createdAt, options.dateTo));
    }

    // Fetch total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(evidence)
      .where(and(...filters));

    const total = countResult[0]?.count || 0;

    // Fetch paginated items
    const rows = await db
      .select()
      .from(evidence)
      .where(and(...filters))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    const items: EvidenceItem[] = rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: row.source || "unknown",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));

    return { items, total };
  } catch (error) {
    console.error("[Evidence Query] Error fetching all evidence:", error);
    throw error;
  }
}

/**
 * Fetch evidence from Gmail
 */
export async function getGmailEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "Gmail")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "Gmail",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching Gmail evidence:", error);
    return [];
  }
}

/**
 * Fetch evidence from Outlook
 */
export async function getOutlookEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "Outlook")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "Outlook",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching Outlook evidence:", error);
    return [];
  }
}

/**
 * Fetch evidence from Google Drive
 */
export async function getGoogleDriveEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "Google Drive")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "Google Drive",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching Google Drive evidence:", error);
    return [];
  }
}

/**
 * Fetch evidence from OneDrive
 */
export async function getOneDriveEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "OneDrive")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "OneDrive",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching OneDrive evidence:", error);
    return [];
  }
}

/**
 * Fetch evidence from Slack
 */
export async function getSlackEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "Slack")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "Slack",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching Slack evidence:", error);
    return [];
  }
}

/**
 * Fetch evidence from Trello
 */
export async function getTrelloEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "Trello")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "Trello",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching Trello evidence:", error);
    return [];
  }
}

/**
 * Fetch evidence from Telegram
 */
export async function getTelegramEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "Telegram")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "Telegram",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching Telegram evidence:", error);
    return [];
  }
}

/**
 * Fetch evidence from manual uploads
 */
export async function getManualUploadEvidence(
  caseId: string,
  options?: { limit?: number; offset?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.caseId, caseId), eq(evidence.source, "Manual Upload")))
      .orderBy(desc(evidence.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: "Manual Upload",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching manual upload evidence:", error);
    return [];
  }
}

/**
 * Calculate comprehensive statistics for evidence
 */
export async function getEvidenceStatistics(caseId: string): Promise<EvidenceStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalItems: 0,
      relevantItems: 0,
      irrelevantItems: 0,
      avgRelevanceScore: 0,
      collectionRate: 0,
      sourceBreakdown: {},
      typeBreakdown: {},
      dailyCollectionTrend: [],
      sourceQuality: [],
      lastUpdated: new Date(),
    };
  }

  try {
    // Get all evidence for the case
    const allEvidence = await db
      .select()
      .from(evidence)
      .where(eq(evidence.caseId, caseId));

    const totalItems = allEvidence.length;
    const relevantItems = allEvidence.filter((e) => e.relevant).length;
    const irrelevantItems = totalItems - relevantItems;

    // Calculate source breakdown
    const sourceBreakdown: Record<string, number> = {};
    allEvidence.forEach((item) => {
      const source = item.source || "Unknown";
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
    });

    // Calculate type breakdown
    const typeBreakdown: Record<string, number> = {};
    allEvidence.forEach((item) => {
      typeBreakdown[item.type] = (typeBreakdown[item.type] || 0) + 1;
    });

    // Calculate daily collection trend
    const dailyTrend: Record<string, number> = {};
    allEvidence.forEach((item) => {
      const date = new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      dailyTrend[date] = (dailyTrend[date] || 0) + 1;
    });

    const dailyCollectionTrend = Object.entries(dailyTrend)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate source quality (relevance ratio per source)
    const sourceQuality = Object.entries(sourceBreakdown).map(([source, count]) => {
      const sourceItems = allEvidence.filter((e) => e.source === source);
      const relevantCount = sourceItems.filter((e) => e.relevant).length;
      const quality = count > 0 ? (relevantCount / count) * 100 : 0;
      return { source, quality: Math.round(quality) };
    });

    return {
      totalItems,
      relevantItems,
      irrelevantItems,
      avgRelevanceScore: totalItems > 0 ? (relevantItems / totalItems) * 100 : 0,
      collectionRate: totalItems,
      sourceBreakdown,
      typeBreakdown,
      dailyCollectionTrend,
      sourceQuality,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error("[Evidence Query] Error calculating statistics:", error);
    throw error;
  }
}

/**
 * Get evidence timeline (chronological view)
 */
export async function getEvidenceTimeline(
  caseId: string,
  options?: { limit?: number }
): Promise<EvidenceItem[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const limit = options?.limit || 100;

    const rows = await db
      .select()
      .from(evidence)
      .where(eq(evidence.caseId, caseId))
      .orderBy(desc(evidence.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      title: row.title,
      description: row.description || undefined,
      source: row.source || "unknown",
      type: row.type,
      timestamp: row.createdAt,
      relevance: row.relevant,
      size: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));
  } catch (error) {
    console.error("[Evidence Query] Error fetching timeline:", error);
    return [];
  }
}

/**
 * Get collection health metrics
 */
export async function getCollectionHealth(caseId: string) {
  const db = await getDb();
  if (!db) {
    return {
      lastCollectionTime: null,
      activeConnections: 0,
      failedCollections: 0,
      nextScheduledSync: null,
    };
  }

  try {
    const allEvidence = await db
      .select()
      .from(evidence)
      .where(eq(evidence.caseId, caseId))
      .orderBy(desc(evidence.createdAt))
      .limit(1);

    const lastCollectionTime = allEvidence[0]?.createdAt || null;

    // Count unique sources
    const sources = await db
      .selectDistinct({ source: evidence.source })
      .from(evidence)
      .where(eq(evidence.caseId, caseId));

    const activeConnections = sources.length;

    return {
      lastCollectionTime,
      activeConnections,
      failedCollections: 0,
      nextScheduledSync: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
    };
  } catch (error) {
    console.error("[Evidence Query] Error fetching collection health:", error);
    throw error;
  }
}
