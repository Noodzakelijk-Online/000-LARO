import { eq, desc, sql, and, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { InsertUser, users, lawyers, cases, outreachStatus, emailActivity, systemConfig, evidence } from "./schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Determine DB path (using .laro.sqlite in current dir for now, 
// will be refined in Electron to use app.getPath('userData'))
const DB_FILE = process.env.DATABASE_URL || "laro.sqlite";

export async function getDb() {
  if (!_db) {
    try {
      const sqlite = new Database(DB_FILE);
      _db = drizzle(sqlite);
      console.log("[Database] SQLite initialized at:", DB_FILE);
    } catch (error) {
      console.error("[Database] Failed to connect to SQLite:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      lastSignedIn: user.lastSignedIn ?? new Date(),
      role: user.role ?? (user.id === ENV.ownerId ? 'admin' : 'user'),
    };

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.id,
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: values.lastSignedIn,
        role: values.role,
      },
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Lawyer queries
export async function getAllLawyers() {
  const db = await getDb();
  if (!db) return [];
  // SQLite orderBy uses the column directly or within desc() from drizzle-orm
  return await db.select().from(lawyers).orderBy(desc(lawyers.createdAt));
}

export async function getLawyerById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lawyers).where(eq(lawyers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Case queries
export async function getAllCases() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cases).orderBy(desc(cases.createdAt));
}

export async function getCaseById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentCases(limit: number = 5, userId?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let qb = db.select().from(cases).orderBy(desc(cases.createdAt)).limit(limit);
  
  if (userId) {
    // In SQLite Drizzle, we can chain .where() normally
    return await qb.where(eq(cases.userId, userId));
  }
  
  return await qb;
}

export async function createCase(data: {
  userId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  caseType: string;
  caseSummary: string;
  urgency: string;
  legalAreas?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const caseId = `CASE${Date.now().toString().slice(-6)}`;
  
  await db.insert(cases).values({
    id: caseId,
    userId: data.userId,
    clientName: data.clientName,
    clientEmail: data.clientEmail || null,
    clientPhone: data.clientPhone || null,
    clientAddress: data.clientAddress || null,
    caseType: data.caseType,
    caseSummary: data.caseSummary,
    urgency: data.urgency,
    status: "Matching",
    legalAreas: data.legalAreas || JSON.stringify([data.caseType]),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  return { id: caseId, success: true };
}

export async function updateCase(caseId: string, data: {
  caseSummary?: string;
  urgency?: string;
  legalAreas?: string | string[] | any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { updatedAt: new Date() };
  if (data.caseSummary !== undefined) updateData.caseSummary = data.caseSummary;
  if (data.urgency !== undefined) updateData.urgency = data.urgency;
  
  if (data.legalAreas !== undefined) {
    const { sanitizeLegalAreas } = await import("./legalAreasValidator");
    updateData.legalAreas = sanitizeLegalAreas(data.legalAreas);
  }
  
  await db.update(cases)
    .set(updateData)
    .where(eq(cases.id, caseId));
  
  return { id: caseId, success: true };
}

// Outreach status queries
export async function getOutreachByCaseId(caseId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      id: outreachStatus.id,
      caseId: outreachStatus.caseId,
      lawyerId: outreachStatus.lawyerId,
      status: outreachStatus.status,
      initialContact: outreachStatus.initialContact,
      lastContact: outreachStatus.lastContact,
      followUpsSent: outreachStatus.followUpsSent,
      responseTimeHours: outreachStatus.responseTimeHours,
      acceptanceStatus: outreachStatus.acceptanceStatus,
      response: outreachStatus.response,
      notes: outreachStatus.notes,
      distanceKm: outreachStatus.distanceKm,
      createdAt: outreachStatus.createdAt,
      updatedAt: outreachStatus.updatedAt,
      lawyerName: lawyers.name,
      lawyerEmail: lawyers.email,
      lawyerPhone: lawyers.phone,
    })
    .from(outreachStatus)
    .leftJoin(lawyers, eq(outreachStatus.lawyerId, lawyers.id))
    .where(eq(outreachStatus.caseId, caseId));
}

export async function getInterestedMatches(limit: number = 10, userId?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const query = db
    .select({
      id: outreachStatus.id,
      caseId: outreachStatus.caseId,
      lawyerId: outreachStatus.lawyerId,
      status: outreachStatus.status,
      lastContact: outreachStatus.lastContact,
      distanceKm: outreachStatus.distanceKm,
      lawyerName: lawyers.name,
      lawyerEmail: lawyers.email,
      caseName: cases.clientName,
      caseType: cases.caseType,
      userId: cases.userId,
    })
    .from(outreachStatus)
    .leftJoin(lawyers, eq(outreachStatus.lawyerId, lawyers.id))
    .leftJoin(cases, eq(outreachStatus.caseId, cases.id))
    .where(eq(outreachStatus.status, "Interested"))
    .orderBy(desc(outreachStatus.lastContact))
    .limit(limit);
  
  const results = await query;
  
  if (userId) {
    return results.filter(r => r.userId === userId);
  }
  
  return results;
}

// Email activity queries
export async function getRecentEmailActivity(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailActivity)
    .orderBy(desc(emailActivity.sentAt))
    .limit(limit);
}

export async function getEmailActivityStats() {
  const db = await getDb();
  if (!db) return { total: 0, responded: 0, interested: 0, declined: 0, noResponse: 0 };
  
  const total = await db.select({ count: sql<number>`count(*)` }).from(emailActivity);
  const responded = await db.select({ count: sql<number>`count(*)` })
    .from(emailActivity)
    .where(eq(emailActivity.responseReceived, "Yes"));
  const interested = await db.select({ count: sql<number>`count(*)` })
    .from(emailActivity)
    .where(eq(emailActivity.responseStatus, "Interested"));
  const declined = await db.select({ count: sql<number>`count(*)` })
    .from(emailActivity)
    .where(eq(emailActivity.responseStatus, "Declined"));
  const noResponse = await db.select({ count: sql<number>`count(*)` })
    .from(emailActivity)
    .where(eq(emailActivity.responseStatus, "No Response"));

  return {
    total: Number(total[0]?.count || 0),
    responded: Number(responded[0]?.count || 0),
    interested: Number(interested[0]?.count || 0),
    declined: Number(declined[0]?.count || 0),
    noResponse: Number(noResponse[0]?.count || 0),
  };
}

// Dashboard statistics
export async function getDashboardStats(userId?: string) {
  const db = await getDb();
  if (!db) return {
    totalLawyers: 0,
    totalCases: 0,
    activeCases: 0,
    matchesMade: 0,
    evidenceCollected: 0,
  };

  const totalLawyers = await db.select({ count: sql<number>`count(*)` }).from(lawyers);
  
  let totalCases, activeCases, matchesMade;
  
  if (userId) {
    totalCases = await db.select({ count: sql<number>`count(*)` })
      .from(cases)
      .where(eq(cases.userId, userId));
    activeCases = await db.select({ count: sql<number>`count(*)` })
      .from(cases)
      .where(and(eq(cases.userId, userId), sql`status IN ('Matching', 'Outreach')`));
    matchesMade = await db.select({ count: sql<number>`count(*)` })
      .from(cases)
      .where(and(eq(cases.userId, userId), eq(cases.status, 'Matched')));
  } else {
    totalCases = await db.select({ count: sql<number>`count(*)` }).from(cases);
    activeCases = await db.select({ count: sql<number>`count(*)` })
      .from(cases)
      .where(sql`status IN ('Matching', 'Outreach')`);
    matchesMade = await db.select({ count: sql<number>`count(*)` })
      .from(cases)
      .where(eq(cases.status, "Matched"));
  }

  let evidenceCount;
  if (userId) {
    evidenceCount = await db.select({ count: sql<number>`count(*)` })
      .from(evidence)
      .where(eq(evidence.userId, userId));
  } else {
    evidenceCount = await db.select({ count: sql<number>`count(*)` }).from(evidence);
  }

  return {
    totalLawyers: Number(totalLawyers[0]?.count || 0),
    totalCases: Number(totalCases[0]?.count || 0),
    activeCases: Number(activeCases[0]?.count || 0),
    matchesMade: Number(matchesMade[0]?.count || 0),
    evidenceCollected: Number(evidenceCount[0]?.count || 0),
  };
}

// System config
export async function getConfig(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(systemConfig).where(eq(systemConfig.configKey, key)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}




// ============================================================================
// NEW MATCH SCORING SYSTEM
// ============================================================================

/**
 * Calculate response rate for a lawyer
 * Formula: (Total Responses / Total Outreaches) × 100%
 */
export async function calculateResponseRate(lawyerId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const lawyer = await db.select().from(lawyers).where(eq(lawyers.id, lawyerId)).limit(1);
  if (!lawyer.length) return 0;
  
  const totalOutreaches = parseInt(lawyer[0].totalOutreaches || "0");
  const totalResponses = parseInt(lawyer[0].totalResponses || "0");
  
  if (totalOutreaches === 0) return -1; // -1 indicates new lawyer (no history)
  
  return (totalResponses / totalOutreaches) * 100;
}

/**
 * Calculate average response time in hours for a lawyer
 */
export async function calculateAverageResponseTime(lawyerId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const outreaches = await db
    .select()
    .from(outreachStatus)
    .where(
      and(
        eq(outreachStatus.lawyerId, lawyerId),
        isNotNull(outreachStatus.responseTimeHours)
      )
    );
  
  if (outreaches.length === 0) return null;
  
  const totalHours = outreaches.reduce((sum, o) => {
    return sum + parseInt(o.responseTimeHours || "0");
  }, 0);
  
  return totalHours / outreaches.length;
}

/**
 * Calculate acceptance rate for a lawyer
 * Formula: (Cases Accepted / Total Responses) × 100%
 */
export async function calculateAcceptanceRate(lawyerId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const lawyer = await db.select().from(lawyers).where(eq(lawyers.id, lawyerId)).limit(1);
  if (!lawyer.length) return 0;
  
  const totalResponses = parseInt(lawyer[0].totalResponses || "0");
  const totalAcceptances = parseInt(lawyer[0].totalAcceptances || "0");
  
  if (totalResponses === 0) return 0;
  
  return (totalAcceptances / totalResponses) * 100;
}

/**
 * Update lawyer statistics based on outreach history
 */
export async function updateLawyerStatistics(lawyerId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Count total outreaches
  const totalOutreaches = await db
    .select()
    .from(outreachStatus)
    .where(eq(outreachStatus.lawyerId, lawyerId));
  
  // Count responses (Interested or Declined)
  const responses = totalOutreaches.filter(o => 
    o.status === "Interested" || o.status === "Declined"
  );
  
  // Count acceptances (Interested only)
  const acceptances = totalOutreaches.filter(o => 
    o.acceptanceStatus === "Accepted"
  );
  
  // Calculate average response time
  const avgResponseTime = await calculateAverageResponseTime(lawyerId);
  
  // Update lawyer record
  await db.update(lawyers)
    .set({
      totalOutreaches: totalOutreaches.length.toString(),
      totalResponses: responses.length.toString(),
      totalAcceptances: acceptances.length.toString(),
      averageResponseTimeHours: avgResponseTime?.toString() || null,
      updatedAt: new Date(),
    })
    .where(eq(lawyers.id, lawyerId));
}

/**
 * Check if lawyer should be permanently filtered
 * Rule: 0% response rate with 3+ contacts
 */
export async function checkPermanentFilter(lawyerId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const lawyer = await db.select().from(lawyers).where(eq(lawyers.id, lawyerId)).limit(1);
  if (!lawyer.length) return false;
  
  const totalOutreaches = parseInt(lawyer[0].totalOutreaches || "0");
  const totalResponses = parseInt(lawyer[0].totalResponses || "0");
  
  // If 3+ contacts with 0 responses, permanently filter
  if (totalOutreaches >= 3 && totalResponses === 0) {
    // Set filter for 6 months
    const filterUntil = new Date();
    filterUntil.setMonth(filterUntil.getMonth() + 6);
    
    await db.update(lawyers)
      .set({
        permanentlyFiltered: "Yes",
        filterUntil: filterUntil,
        updatedAt: new Date(),
      })
      .where(eq(lawyers.id, lawyerId));
    
    return true;
  }
  
  return false;
}

/**
 * Calculate NEW match score for a lawyer
 * Maximum: ~150 points
 */
export function calculateNewMatchScore(lawyer: any, distanceKm: number): number {
  let score = 0;
  
  // 1. Case-load Score (50 points max)
  const caseLoad = parseInt(lawyer.caseLoad || "999");
  if (caseLoad <= 10) score += 50;
  else if (caseLoad <= 20) score += 30;
  else if (caseLoad <= 30) score += 10;
  // else 0 points
  
  // 2. Response Rate Score (50 points max)
  const responseRate = calculateResponseRateSync(lawyer);
  if (responseRate === -1) {
    // New lawyer - benefit of doubt
    score += 25;
  } else if (responseRate >= 80) score += 50;
  else if (responseRate >= 60) score += 30;
  else if (responseRate >= 40) score += 10;
  // else 0 points
  
  // 3. Average Response Time Score (30 points max)
  const avgResponseTime = parseFloat(lawyer.averageResponseTimeHours || "999");
  if (avgResponseTime <= 48) score += 30;
  else if (avgResponseTime <= 168) score += 20; // 7 days
  else if (avgResponseTime <= 336) score += 10; // 14 days
  // else 0 points
  
  // 4. Acceptance Rate Score (30 points max)
  const acceptanceRate = calculateAcceptanceRateSync(lawyer);
  if (acceptanceRate >= 80) score += 30;
  else if (acceptanceRate >= 60) score += 20;
  else if (acceptanceRate >= 40) score += 10;
  // else 0 points
  
  // 5. Distance Score (10 points max)
  if (distanceKm <= 25) score += 10;
  else if (distanceKm <= 50) score += 5;
  else if (distanceKm <= 100) score += 2;
  // else 0 points
  
  // 6. Years Practicing Score (10 points max)
  const yearsExp = parseInt(lawyer.experienceYears || "0");
  if (yearsExp >= 10) score += 10;
  else if (yearsExp >= 5) score += 5;
  else if (yearsExp >= 2) score += 2;
  // else 0 points
  
  return score;
}

/**
 * Synchronous helper to calculate response rate from lawyer object
 */
function calculateResponseRateSync(lawyer: any): number {
  const totalOutreaches = parseInt(lawyer.totalOutreaches || "0");
  const totalResponses = parseInt(lawyer.totalResponses || "0");
  
  if (totalOutreaches === 0) return -1; // New lawyer
  
  return (totalResponses / totalOutreaches) * 100;
}

/**
 * Synchronous helper to calculate acceptance rate from lawyer object
 */
function calculateAcceptanceRateSync(lawyer: any): number {
  const totalResponses = parseInt(lawyer.totalResponses || "0");
  const totalAcceptances = parseInt(lawyer.totalAcceptances || "0");
  
  if (totalResponses === 0) return 0;
  
  return (totalAcceptances / totalResponses) * 100;
}

/**
 * Check if lawyer passes mandatory filters
 */
export function passesMandatoryFilters(lawyer: any): boolean {
  // 1. Not on case-stop
  if (lawyer.caseStop === "Yes") return false;
  
  // 2. Good standing with Bar Association
  if (lawyer.barAssociationStatus !== "Good Standing") return false;
  
  // 3. Currently accepting cases
  if (lawyer.currentlyAccepting === "No") return false;
  
  // 4. Valid contact information
  if (!lawyer.email && !lawyer.phone) return false;
  
  // 5. Not permanently filtered
  if (lawyer.permanentlyFiltered === "Yes") {
    // Check if filter has expired
    if (lawyer.filterUntil) {
      const now = new Date();
      const filterUntil = new Date(lawyer.filterUntil);
      if (now < filterUntil) return false; // Still filtered
    } else {
      return false; // Permanently filtered with no expiry
    }
  }
  
  return true;
}

