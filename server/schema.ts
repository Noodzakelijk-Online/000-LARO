/**
 * Drizzle schema — tables referenced across the server.
 * Columns are kept permissive (text/varchar) so the codebase compiles; align with your real DB as needed.
 */
import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  mysqlEnum,
  index,
} from "drizzle-orm/mysql-core";

// ─── Users & auth ───────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", [
    "free",
    "active",
    "past_due",
    "canceled",
    "trialing",
  ]).default("free"),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "pro", "enterprise"]).default("free"),
  emailPreferences: text("emailPreferences"),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Lawyers ─────────────────────────────────────────────────────────────────

export const lawyers = mysqlTable(
  "lawyers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 512 }),
    city: varchar("city", { length: 256 }),
    firm: varchar("firm", { length: 512 }),
    firmName: varchar("firmName", { length: 512 }),
    legalAreas: text("legalAreas"),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 64 }),
    website: varchar("website", { length: 512 }),
    permanentlyFiltered: varchar("permanentlyFiltered", { length: 8 }),
    filterUntil: timestamp("filterUntil"),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  },
  (t) => ({ cityIdx: index("lawyers_city_idx").on(t.city) })
);

export type Lawyer = typeof lawyers.$inferSelect;

// ─── Cases & evidence ───────────────────────────────────────────────────────

export const cases = mysqlTable(
  "cases",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("userId", { length: 64 }).notNull(),
    clientName: varchar("clientName", { length: 512 }),
    clientEmail: varchar("clientEmail", { length: 320 }),
    caseType: varchar("caseType", { length: 256 }),
    caseSummary: text("caseSummary"),
    urgency: varchar("urgency", { length: 32 }),
    status: varchar("status", { length: 64 }).default("active"),
    legalAreas: text("legalAreas"),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  },
  (t) => ({
    userIdx: index("cases_userId_idx").on(t.userId),
  })
);

export const evidence = mysqlTable(
  "evidence",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    caseId: varchar("caseId", { length: 64 }).notNull(),
    userId: varchar("userId", { length: 64 }).notNull(),
    type: mysqlEnum("type", ["document", "email", "chat", "photo", "video", "audio", "other"]).notNull(),
    source: varchar("source", { length: 128 }),
    title: varchar("title", { length: 512 }).notNull(),
    description: text("description"),
    fileUrl: text("fileUrl"),
    fileName: varchar("fileName", { length: 512 }),
    fileSize: varchar("fileSize", { length: 32 }),
    mimeType: varchar("mimeType", { length: 128 }),
    metadata: text("metadata"),
    tags: text("tags"),
    relevant: boolean("relevant").default(true),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  },
  (table) => ({
    caseIdIdx: index("evidence_caseId_idx").on(table.caseId),
    userIdIdx: index("evidence_userId_idx").on(table.userId),
  })
);

export const evidenceItems = mysqlTable("evidence_items", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  title: varchar("title", { length: 512 }),
  source: varchar("source", { length: 128 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const evidenceSources = mysqlTable("evidence_sources", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  provider: varchar("provider", { length: 64 }),
  sourceType: varchar("sourceType", { length: 64 }),
  externalId: varchar("externalId", { length: 256 }),
  status: varchar("status", { length: 64 }),
  accessToken: text("accessToken"),
  itemsCollected: int("itemsCollected"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  connectedAt: timestamp("connectedAt"),
  errorMessage: text("errorMessage"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const evidenceFiles = mysqlTable(
  "evidence_files",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    caseId: varchar("caseId", { length: 64 }),
    userId: varchar("userId", { length: 64 }).notNull(),
    fileType: varchar("fileType", { length: 128 }),
    fileSize: varchar("fileSize", { length: 32 }),
    uploadSource: mysqlEnum("uploadSource", ["manual", "agent"]).default("manual"),
    uploadedAt: timestamp("uploadedAt").defaultNow(),
    fileName: varchar("fileName", { length: 512 }),
    mimeType: varchar("mimeType", { length: 128 }),
    storageKey: text("storageKey"),
  },
  (t) => ({ userIdx: index("evidence_files_user_idx").on(t.userId) })
);

export const evidenceTags = mysqlTable("evidence_tags", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  name: varchar("name", { length: 256 }),
  color: varchar("color", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const evidenceFileTags = mysqlTable("evidence_file_tags", {
  id: varchar("id", { length: 64 }).primaryKey(),
  evidenceFileId: varchar("evidenceFileId", { length: 64 }),
  tagId: varchar("tagId", { length: 64 }),
});

// ─── Email & comms ────────────────────────────────────────────────────────────

export const emailAccounts = mysqlTable("email_accounts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 64 }),
  email: varchar("email", { length: 320 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiry: timestamp("tokenExpiry"),
  status: varchar("status", { length: 64 }),
  connectedAt: timestamp("connectedAt"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const emailSyncJobs = mysqlTable("email_sync_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  accountId: varchar("accountId", { length: 64 }),
  caseId: varchar("caseId", { length: 64 }),
  status: varchar("status", { length: 64 }),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  keywords: text("keywords"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const emailMessages = mysqlTable("email_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  accountId: varchar("accountId", { length: 64 }),
  caseId: varchar("caseId", { length: 64 }),
  category: varchar("category", { length: 64 }),
  relevanceScore: varchar("relevanceScore", { length: 32 }),
  subject: text("subject"),
  body: text("body"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const emailActivity = mysqlTable("email_activity", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  lawyerId: varchar("lawyerId", { length: 64 }),
  activityType: varchar("activityType", { length: 64 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const outreachStatus = mysqlTable("outreach_status", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  lawyerId: varchar("lawyerId", { length: 64 }),
  status: varchar("status", { length: 64 }),
  metadata: text("metadata"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  caseId: varchar("caseId", { length: 64 }),
  content: text("content"),
  threadId: varchar("threadId", { length: 64 }),
  parentId: varchar("parentId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const communications = mysqlTable("communications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  channel: varchar("channel", { length: 64 }),
  body: text("body"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  title: varchar("title", { length: 512 }),
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ─── Billing & usage ─────────────────────────────────────────────────────────

export const billingPeriods = mysqlTable("billing_periods", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  metadata: text("metadata"),
  totalCost: varchar("totalCost", { length: 32 }),
});

export const usageTracking = mysqlTable("usage_tracking", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  resourceType: varchar("resourceType", { length: 128 }),
  quantity: varchar("quantity", { length: 32 }),
  baseCost: varchar("baseCost", { length: 32 }),
  billedCost: varchar("billedCost", { length: 32 }),
  metadata: text("metadata"),
  caseId: varchar("caseId", { length: 64 }),
  reportedToStripe: boolean("reportedToStripe").default(false),
  stripeUsageRecordId: varchar("stripeUsageRecordId", { length: 128 }),
  timestamp: timestamp("timestamp"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const usageLimits = mysqlTable("usage_limits", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  tier: varchar("tier", { length: 64 }),
  resourceType: varchar("resourceType", { length: 128 }),
  monthlyLimit: varchar("monthlyLimit", { length: 32 }),
  description: text("description"),
  limitsJson: text("limitsJson"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

// ─── Integrations & misc ─────────────────────────────────────────────────────

export const googleDriveFiles = mysqlTable("google_drive_files", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  caseId: varchar("caseId", { length: 64 }),
  accountId: varchar("accountId", { length: 64 }),
  googleFileId: varchar("googleFileId", { length: 256 }),
  fileName: varchar("fileName", { length: 512 }),
  mimeType: varchar("mimeType", { length: 256 }),
  fileSize: varchar("fileSize", { length: 64 }),
  s3Key: text("s3Key"),
  s3Url: text("s3Url"),
  googleWebViewLink: text("googleWebViewLink"),
  googleModifiedTime: timestamp("googleModifiedTime"),
  evidenceType: varchar("evidenceType", { length: 64 }),
  isIncluded: varchar("isIncluded", { length: 8 }),
  relevanceScore: varchar("relevanceScore", { length: 32 }),
  category: varchar("category", { length: 128 }),
  userNotes: text("userNotes"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const systemConfig = mysqlTable("system_config", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const clarificationQuestions = mysqlTable("clarification_questions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  question: text("question"),
  answer: text("answer"),
  status: varchar("status", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const savedSearches = mysqlTable("saved_searches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  name: varchar("name", { length: 256 }),
  queryJson: text("queryJson"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const userPreferences = mysqlTable("user_preferences", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  key: varchar("key", { length: 128 }),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const messageTemplates = mysqlTable("message_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  name: varchar("name", { length: 256 }),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  title: varchar("title", { length: 512 }),
  body: text("body"),
  read: boolean("read").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type InsertNotification = typeof notifications.$inferInsert;

export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  action: varchar("action", { length: 128 }),
  resource: varchar("resource", { length: 128 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type InsertAuditLog = typeof auditLogs.$inferInsert;

export const bulkImportJobs = mysqlTable("bulk_import_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  filename: varchar("filename", { length: 256 }),
  status: varchar("status", { length: 64 }),
  totalRows: varchar("totalRows", { length: 16 }).default("0"),
  processedRows: varchar("processedRows", { length: 16 }).default("0"),
  failedRows: varchar("failedRows", { length: 16 }).default("0"),
  errors: text("errors"),
  completedAt: timestamp("completedAt"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const extractedEntities = mysqlTable("extracted_entities", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  entityType: varchar("entityType", { length: 64 }),
  value: text("value"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type InsertExtractedEntity = typeof extractedEntities.$inferInsert;

export const lawyerRatings = mysqlTable("lawyer_ratings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  lawyerId: varchar("lawyerId", { length: 64 }),
  overallRating: varchar("overallRating", { length: 32 }),
  metadata: text("metadata"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const lawyerInteractions = mysqlTable("lawyer_interactions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  lawyerId: varchar("lawyerId", { length: 64 }),
  caseId: varchar("caseId", { length: 64 }),
  interactionType: varchar("interactionType", { length: 64 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const ratingCalculationLogs = mysqlTable("rating_calculation_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  lawyerId: varchar("lawyerId", { length: 64 }),
  log: text("log"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ─── Gap analysis & timeline ─────────────────────────────────────────────────

export const communicationGaps = mysqlTable("communication_gaps", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  data: text("data"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const expectedDocuments = mysqlTable("expected_documents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  data: text("data"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const suspiciousPatterns = mysqlTable("suspicious_patterns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  data: text("data"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const legalInferences = mysqlTable("legal_inferences", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  data: text("data"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const caseStrengthAnalysis = mysqlTable("case_strength_analysis", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  data: text("data"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const timeline = mysqlTable("timeline", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  eventType: varchar("eventType", { length: 64 }),
  title: varchar("title", { length: 512 }),
  description: text("description"),
  eventAt: timestamp("eventAt"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type CommunicationGap = typeof communicationGaps.$inferSelect;
export type ExpectedDocument = typeof expectedDocuments.$inferSelect;
export type SuspiciousPattern = typeof suspiciousPatterns.$inferSelect;
export type LegalInference = typeof legalInferences.$inferSelect;
export type Communication = typeof communications.$inferSelect;
export type Timeline = typeof timeline.$inferSelect;
export type Case = typeof cases.$inferSelect;

// ─── Auto-collection & unified inbox ─────────────────────────────────────────

export const autoCollectionSettings = mysqlTable("auto_collection_settings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  keywords: text("keywords"),
  metadata: text("metadata"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const autoCollectionLogs = mysqlTable("auto_collection_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  message: text("message"),
  level: varchar("level", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const keywordMatches = mysqlTable("keyword_matches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  caseId: varchar("caseId", { length: 64 }),
  keyword: varchar("keyword", { length: 256 }),
  source: varchar("source", { length: 64 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const unifiedMessages = mysqlTable("unified_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  threadId: varchar("threadId", { length: 64 }),
  channel: varchar("channel", { length: 64 }),
  body: text("body"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type InsertUnifiedMessage = typeof unifiedMessages.$inferInsert;

export const conversationThreads = mysqlTable("conversation_threads", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  title: varchar("title", { length: 512 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type InsertConversationThread = typeof conversationThreads.$inferInsert;

export const channelIntegrations = mysqlTable("channel_integrations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }),
  provider: varchar("provider", { length: 64 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type InsertChannelIntegration = typeof channelIntegrations.$inferInsert;
