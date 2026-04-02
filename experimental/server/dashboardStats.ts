import { getDb } from "./db";
import { cases, outreachStatus, evidenceItems, lawyers } from "./schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

export interface DashboardStats {
  // Case statistics
  totalCases: number;
  activeCases: number;
  closedCases: number;
  draftCases: number;
  
  // Lawyer statistics
  totalLawyers: number;
  lawyersContacted: number;
  lawyersResponded: number;
  lawyersAccepted: number;
  
  // Evidence statistics
  totalDocuments: number;
  documentsAnalyzed: number;
  
  // Response metrics
  averageResponseTime: number; // in hours
  responseRate: number; // percentage
  acceptanceRate: number; // percentage
  
  // Recent activity
  recentCases: number; // Last 7 days
  recentOutreach: number; // Last 7 days
}

export interface ActivityFeedItem {
  id: string;
  type: "case_created" | "lawyer_contacted" | "lawyer_responded" | "document_uploaded" | "status_changed";
  title: string;
  description: string;
  timestamp: Date;
  caseId?: number;
  lawyerId?: string;
  metadata?: any;
}

export interface ProgressMetrics {
  caseId: number;
  caseName: string;
  status: string;
  progress: number; // 0-100
  lawyersContacted: number;
  lawyersResponded: number;
  documentsUploaded: number;
  daysActive: number;
}

/**
 * Get comprehensive dashboard statistics
 */
export async function getDashboardStatistics(userId: string): Promise<DashboardStats> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get user's cases
  const userCases = await db
    .select()
    .from(cases)
    .where(eq(cases.userId, userId));

  const caseIds = userCases.map(c => c.id);

  // Case statistics
  const totalCases = userCases.length;
  const activeCases = userCases.filter(c => c.status === "active" || c.status === "awaiting_response").length;
  const closedCases = userCases.filter(c => c.status === "closed").length;
  const draftCases = userCases.filter(c => c.status === "draft").length;

  // Get outreach data for user's cases
  let outreaches: any[] = [];
  if (caseIds.length > 0) {
    outreaches = await db
      .select()
      .from(outreachStatus)
      .where(sql`${outreachStatus.caseId} IN (${sql.join(caseIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Lawyer statistics
  const lawyersContacted = new Set(outreaches.map(o => o.lawyerId)).size;
  const lawyersResponded = outreaches.filter(o => o.status !== "Contacted" && o.status !== "No Response").length;
  const lawyersAccepted = outreaches.filter(o => o.acceptanceStatus === "Accepted").length;

  // Evidence statistics
  let documents: any[] = [];
  if (caseIds.length > 0) {
    documents = await db
      .select()
      .from(evidenceItems)
      .where(sql`${evidenceItems.caseId} IN (${sql.join(caseIds.map(id => sql`${id}`), sql`, `)})`);
  }

  const totalDocuments = documents.length;
  const documentsAnalyzed = documents.filter(d => d.aiAnalysis).length;

  // Response metrics
  const responseTimes = outreaches
    .filter(o => o.responseTimeHours)
    .map(o => parseFloat(o.responseTimeHours as string));
  
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const responseRate = lawyersContacted > 0
    ? (lawyersResponded / lawyersContacted) * 100
    : 0;

  const acceptanceRate = lawyersResponded > 0
    ? (lawyersAccepted / lawyersResponded) * 100
    : 0;

  // Recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentCases = userCases.filter(c => 
    c.createdAt && new Date(c.createdAt) >= sevenDaysAgo
  ).length;

  const recentOutreach = outreaches.filter(o =>
    o.contactedAt && new Date(o.contactedAt) >= sevenDaysAgo
  ).length;

  // Get total lawyers in database
  const allLawyers = await db.select({ count: sql<number>`count(*)` }).from(lawyers);
  const totalLawyers = allLawyers[0]?.count || 0;

  return {
    totalCases,
    activeCases,
    closedCases,
    draftCases,
    totalLawyers,
    lawyersContacted,
    lawyersResponded,
    lawyersAccepted,
    totalDocuments,
    documentsAnalyzed,
    averageResponseTime,
    responseRate,
    acceptanceRate,
    recentCases,
    recentOutreach
  };
}

/**
 * Get activity feed for dashboard
 */
export async function getActivityFeed(userId: string, limit: number = 20): Promise<ActivityFeedItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const activities: ActivityFeedItem[] = [];

  // Get user's cases
  const userCases = await db
    .select()
    .from(cases)
    .where(eq(cases.userId, userId))
    .orderBy(desc(cases.createdAt))
    .limit(limit);

  // Add case creation activities
  for (const caseItem of userCases) {
    activities.push({
      id: `case-${caseItem.id}`,
      type: "case_created",
      title: "New case created",
      description: `${caseItem.clientName} - ${caseItem.caseType}`,
      timestamp: caseItem.createdAt || new Date(),
      caseId: parseInt(caseItem.id),
      metadata: { caseSummary: caseItem.caseSummary }
    });
  }

  // Get recent outreach activities
  const caseIds = userCases.map(c => c.id);
  if (caseIds.length > 0) {
    const recentOutreach = await db
      .select()
      .from(outreachStatus)
      .where(sql`${outreachStatus.caseId} IN (${sql.join(caseIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(outreachStatus.contactedAt))
      .limit(limit);

    for (const outreach of recentOutreach) {
      if (outreach.contactedAt) {
        activities.push({
          id: `outreach-${outreach.id}`,
          type: "lawyer_contacted",
          title: "Lawyer contacted",
          description: `Reached out to lawyer for case`,
          timestamp: outreach.contactedAt,
          caseId: parseInt(outreach.caseId),
          lawyerId: outreach.lawyerId,
          metadata: { status: outreach.status }
        });
      }
    }
  }

  // Sort by timestamp (newest first) and limit
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return activities.slice(0, limit);
}

/**
 * Get progress metrics for all active cases
 */
export async function getProgressMetrics(userId: string): Promise<ProgressMetrics[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userCases = await db
    .select()
    .from(cases)
    .where(and(
      eq(cases.userId, userId),
      sql`${cases.status} != 'closed' AND ${cases.status} != 'archived'`
    ));

  const metrics: ProgressMetrics[] = [];

  for (const caseItem of userCases) {
    // Get outreach data
    const outreaches = await db
      .select()
      .from(outreachStatus)
      .where(eq(outreachStatus.caseId, caseItem.id.toString()));

    const lawyersContacted = outreaches.length;
    const lawyersResponded = outreaches.filter(o => 
      o.status !== "Contacted" && o.status !== "No Response"
    ).length;

    // Get documents
    const documents = await db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.caseId, caseItem.id));

    const documentsUploaded = documents.length;

    // Calculate days active
    const createdAt = caseItem.createdAt ? new Date(caseItem.createdAt) : new Date();
    const now = new Date();
    const daysActive = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate progress (0-100)
    // Progress based on: documents uploaded (30%), lawyers contacted (30%), lawyers responded (40%)
    let progress = 0;
    if (documentsUploaded > 0) progress += 30;
    if (lawyersContacted > 0) progress += 30;
    if (lawyersResponded > 0) progress += 40;

    metrics.push({
      caseId: caseItem.id,
      caseName: `${caseItem.clientName} - ${caseItem.caseType}`,
      status: caseItem.status || "draft",
      progress,
      lawyersContacted,
      lawyersResponded,
      documentsUploaded,
      daysActive
    });
  }

  return metrics;
}

