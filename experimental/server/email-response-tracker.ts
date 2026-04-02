/**
 * Email Response Tracking Service
 * 
 * Monitors lawyer responses to outreach emails and updates database accordingly.
 * 
 * IMPLEMENTATION STRATEGIES:
 * 1. Reply-To Email Parsing (Recommended for MVP)
 * 2. Gmail API Integration (For production)
 * 3. SendGrid Inbound Parse Webhook (If using SendGrid)
 * 4. AWS SES Receipt Rules (If using SES)
 */

import { getDb } from "./db";
import { outreachStatus, lawyers, emailActivity } from "./schema";
import { eq, and } from "drizzle-orm";

export interface EmailResponse {
  from: string; // Lawyer email
  to: string; // Our system email
  subject: string;
  body: string;
  receivedAt: Date;
  inReplyTo?: string; // Message-ID of original email
  references?: string[]; // Thread references
}

export interface ResponseClassification {
  sentiment: "Interested" | "Declined" | "Neutral" | "Unknown";
  confidence: number; // 0-100
  reason?: string;
  extractedInfo?: {
    availability?: string;
    caseLoad?: number;
    responseTime?: string;
  };
}

/**
 * Classify lawyer response using keyword analysis
 * TODO: Replace with LLM-based classification for better accuracy
 */
export function classifyResponse(emailBody: string, subject: string): ResponseClassification {
  const text = `${subject} ${emailBody}`.toLowerCase();

  // Interested keywords
  const interestedKeywords = [
    "interested",
    "would like to",
    "happy to help",
    "can assist",
    "available",
    "let's discuss",
    "schedule a call",
    "more information",
    "tell me more",
    "yes",
    "graag", // Dutch: gladly
    "beschikbaar", // Dutch: available
    "interesse", // Dutch: interest
  ];

  // Declined keywords
  const declinedKeywords = [
    "not interested",
    "cannot take",
    "unable to assist",
    "not available",
    "case stop",
    "no capacity",
    "fully booked",
    "decline",
    "pass",
    "sorry",
    "unfortunately",
    "niet beschikbaar", // Dutch: not available
    "kan niet", // Dutch: cannot
    "geen capaciteit", // Dutch: no capacity
  ];

  let interestedScore = 0;
  let declinedScore = 0;

  for (const keyword of interestedKeywords) {
    if (text.includes(keyword)) {
      interestedScore += 1;
    }
  }

  for (const keyword of declinedKeywords) {
    if (text.includes(keyword)) {
      declinedScore += 1;
    }
  }

  if (interestedScore > declinedScore && interestedScore > 0) {
    return {
      sentiment: "Interested",
      confidence: Math.min(80 + interestedScore * 5, 95),
      reason: "Positive keywords detected",
    };
  } else if (declinedScore > interestedScore && declinedScore > 0) {
    return {
      sentiment: "Declined",
      confidence: Math.min(80 + declinedScore * 5, 95),
      reason: "Negative keywords detected",
    };
  } else if (interestedScore === declinedScore && interestedScore > 0) {
    return {
      sentiment: "Neutral",
      confidence: 50,
      reason: "Mixed signals",
    };
  } else {
    return {
      sentiment: "Unknown",
      confidence: 30,
      reason: "No clear indicators",
    };
  }
}

/**
 * Process incoming email response from lawyer
 */
export async function processEmailResponse(response: EmailResponse): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Email Response Tracker] Database not available");
    return;
  }

  console.log(`[Email Response Tracker] Processing response from: ${response.from}`);

  // Find lawyer by email
  const lawyerResults = await db
    .select()
    .from(lawyers)
    .where(eq(lawyers.email, response.from))
    .limit(1);

  if (lawyerResults.length === 0) {
    console.warn(`[Email Response Tracker] Lawyer not found for email: ${response.from}`);
    return;
  }

  const lawyer = lawyerResults[0];

  // Classify response
  const classification = classifyResponse(response.body, response.subject);
  console.log(`[Email Response Tracker] Classification: ${classification.sentiment} (${classification.confidence}% confidence)`);

  // Find related outreach record
  // Try to match by inReplyTo or by recent outreach to this lawyer
  const recentOutreach = await db
    .select()
    .from(outreachStatus)
    .where(
      and(
        eq(outreachStatus.lawyerId, lawyer.id),
        eq(outreachStatus.status, "Sent")
      )
    )
    .orderBy(outreachStatus.lastContactedAt)
    .limit(1);

  if (recentOutreach.length === 0) {
    console.warn(`[Email Response Tracker] No recent outreach found for lawyer: ${lawyer.name}`);
    return;
  }

  const outreach = recentOutreach[0];

  // Calculate response time
  const sentAt = outreach.lastContactedAt;
  const receivedAt = response.receivedAt;
  const responseTimeHours = sentAt
    ? Math.round((receivedAt.getTime() - sentAt.getTime()) / (1000 * 60 * 60))
    : null;

  // Update outreach status
  const newStatus = classification.sentiment === "Interested" ? "Interested" : 
                    classification.sentiment === "Declined" ? "Declined" : 
                    "Responded";

  await db
    .update(outreachStatus)
    .set({
      status: newStatus,
      responseReceived: "Yes",
      responseDate: receivedAt,
      responseTimeHours: responseTimeHours?.toString(),
      notes: `${outreach.notes || ""}\n\nResponse received: ${classification.sentiment} (${classification.confidence}% confidence)\nResponse time: ${responseTimeHours}h`,
    })
    .where(eq(outreachStatus.id, outreach.id));

  // Update lawyer statistics
  const currentOutreaches = parseInt(lawyer.totalOutreaches || "0");
  const currentResponses = parseInt(lawyer.totalResponses || "0");
  const currentAcceptances = parseInt(lawyer.totalAcceptances || "0");

  const newResponses = currentResponses + 1;
  const newAcceptances = classification.sentiment === "Interested" 
    ? currentAcceptances + 1 
    : currentAcceptances;

  // Update average response time
  const currentAvgResponseTime = lawyer.averageResponseTimeHours 
    ? parseFloat(lawyer.averageResponseTimeHours) 
    : 0;
  
  const newAvgResponseTime = responseTimeHours
    ? currentAvgResponseTime === 0
      ? responseTimeHours
      : (currentAvgResponseTime * currentResponses + responseTimeHours) / newResponses
    : currentAvgResponseTime;

  await db
    .update(lawyers)
    .set({
      totalResponses: newResponses.toString(),
      totalAcceptances: newAcceptances.toString(),
      averageResponseTimeHours: newAvgResponseTime.toFixed(2),
    })
    .where(eq(lawyers.id, lawyer.id));

  // Update email activity
  await db
    .update(emailActivity)
    .set({
      responseReceived: "Yes",
      responseStatus: classification.sentiment === "Interested" ? "Interested" : 
                      classification.sentiment === "Declined" ? "Declined" : 
                      "No Response",
    })
    .where(
      and(
        eq(emailActivity.lawyerId, lawyer.id),
        eq(emailActivity.caseId, outreach.caseId)
      )
    );

  console.log(`[Email Response Tracker] Updated outreach ${outreach.id} to status: ${newStatus}`);
  console.log(`[Email Response Tracker] Updated lawyer ${lawyer.name} stats: ${newResponses} responses, ${newAcceptances} acceptances`);
}

/**
 * Webhook handler for incoming emails
 * This would be called by your email provider (SendGrid, SES, etc.)
 */
export async function handleIncomingEmailWebhook(webhookData: any): Promise<void> {
  // Parse webhook data based on provider
  // Example for SendGrid Inbound Parse:
  const response: EmailResponse = {
    from: webhookData.from,
    to: webhookData.to,
    subject: webhookData.subject,
    body: webhookData.text || webhookData.html,
    receivedAt: new Date(),
    inReplyTo: webhookData.headers?.["In-Reply-To"],
    references: webhookData.headers?.["References"]?.split(" "),
  };

  await processEmailResponse(response);
}

/**
 * Manual response recording (for testing or manual entry)
 */
export async function recordManualResponse(
  lawyerEmail: string,
  caseId: string,
  sentiment: "Interested" | "Declined",
  notes?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const lawyerResults = await db
    .select()
    .from(lawyers)
    .where(eq(lawyers.email, lawyerEmail))
    .limit(1);

  if (lawyerResults.length === 0) {
    throw new Error(`Lawyer not found: ${lawyerEmail}`);
  }

  const lawyer = lawyerResults[0];

  const outreachResults = await db
    .select()
    .from(outreachStatus)
    .where(
      and(
        eq(outreachStatus.lawyerId, lawyer.id),
        eq(outreachStatus.caseId, caseId)
      )
    )
    .limit(1);

  if (outreachResults.length === 0) {
    throw new Error(`Outreach not found for lawyer ${lawyer.name} and case ${caseId}`);
  }

  const outreach = outreachResults[0];

  await db
    .update(outreachStatus)
    .set({
      status: sentiment,
      responseReceived: "Yes",
      responseDate: new Date(),
      notes: notes || `Manual response recorded: ${sentiment}`,
    })
    .where(eq(outreachStatus.id, outreach.id));

  // Update lawyer stats
  const currentResponses = parseInt(lawyer.totalResponses || "0");
  const currentAcceptances = parseInt(lawyer.totalAcceptances || "0");

  await db
    .update(lawyers)
    .set({
      totalResponses: (currentResponses + 1).toString(),
      totalAcceptances: sentiment === "Interested" 
        ? (currentAcceptances + 1).toString() 
        : currentAcceptances.toString(),
    })
    .where(eq(lawyers.id, lawyer.id));

  console.log(`[Email Response Tracker] Manual response recorded for ${lawyer.name}: ${sentiment}`);
}

