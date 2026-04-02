import { index, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, int } from "drizzle-orm/mysql-core";

/**
 * Email Integration Schema
 * Tables for storing connected email accounts, messages, threads, and attachments
 */

// Email accounts connected by users (Gmail, Outlook, etc.)
export const emailAccounts = mysqlTable("email_accounts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(), // Owner of the email account
  provider: mysqlEnum("provider", ["gmail", "outlook"]).notNull(), // Email provider
  email: varchar("email", { length: 320 }).notNull(), // Email address
  accessToken: text("accessToken"), // Encrypted OAuth access token
  refreshToken: text("refreshToken"), // Encrypted OAuth refresh token
  tokenExpiry: timestamp("tokenExpiry"), // When access token expires
  status: mysqlEnum("status", ["connected", "disconnected", "error"]).default("connected").notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"), // Last time emails were synced
  connectedAt: timestamp("connectedAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  emailIdx: index("email_idx").on(table.email),
  providerIdx: index("provider_idx").on(table.provider),
}));

export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = typeof emailAccounts.$inferInsert;

// Email messages fetched from connected accounts
export const emailMessages = mysqlTable("email_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull(), // Which email account this came from
  caseId: varchar("caseId", { length: 64 }), // Associated case (null if not yet linked)
  messageId: varchar("messageId", { length: 512 }).notNull(), // Provider's unique message ID
  threadId: varchar("threadId", { length: 512 }), // Provider's thread ID
  subject: text("subject"),
  from: varchar("from", { length: 320 }).notNull(), // Sender email
  fromName: varchar("fromName", { length: 256 }), // Sender display name
  to: text("to"), // JSON array of recipient emails
  cc: text("cc"), // JSON array of CC emails
  bcc: text("bcc"), // JSON array of BCC emails
  date: timestamp("date").notNull(), // Email sent date
  body: text("body"), // Email body (HTML or plain text)
  snippet: text("snippet"), // Short preview (first 200 chars)
  hasAttachments: boolean("hasAttachments").default(false),
  labels: text("labels"), // JSON array of labels/folders
  isRead: boolean("isRead").default(false),
  isStarred: boolean("isStarred").default(false),
  // AI Analysis Fields
  relevanceScore: int("relevanceScore"), // 0-100 relevance to case
  category: mysqlEnum("category", ["correspondence", "contract", "invoice", "notice", "legal_document", "other"]),
  extractedParties: text("extractedParties"), // JSON array of names/companies
  extractedDates: text("extractedDates"), // JSON array of important dates
  extractedKeywords: text("extractedKeywords"), // JSON array of legal keywords
  summary: text("summary"), // AI-generated summary
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  accountIdIdx: index("account_id_idx").on(table.accountId),
  caseIdIdx: index("case_id_idx").on(table.caseId),
  messageIdIdx: index("message_id_idx").on(table.messageId),
  threadIdIdx: index("thread_id_idx").on(table.threadId),
  dateIdx: index("date_idx").on(table.date),
  fromIdx: index("from_idx").on(table.from),
}));

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = typeof emailMessages.$inferInsert;

// Email attachments
export const emailAttachments = mysqlTable("email_attachments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull(), // Parent email message
  attachmentId: varchar("attachmentId", { length: 512 }), // Provider's attachment ID
  filename: varchar("filename", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  size: int("size"), // Size in bytes
  s3Key: varchar("s3Key", { length: 512 }), // S3 storage key
  s3Url: text("s3Url"), // S3 public URL
  downloadedAt: timestamp("downloadedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  messageIdIdx: index("message_id_idx").on(table.messageId),
  filenameIdx: index("filename_idx").on(table.filename),
}));

export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = typeof emailAttachments.$inferInsert;

// Email threads (grouped conversations)
export const emailThreads = mysqlTable("email_threads", {
  id: varchar("id", { length: 64 }).primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull(), // Which email account
  caseId: varchar("caseId", { length: 64 }), // Associated case
  threadId: varchar("threadId", { length: 512 }).notNull(), // Provider's thread ID
  subject: text("subject"),
  participants: text("participants"), // JSON array of all email addresses in thread
  messageCount: int("messageCount").default(0),
  firstMessageDate: timestamp("firstMessageDate"),
  lastMessageDate: timestamp("lastMessageDate"),
  hasUnread: boolean("hasUnread").default(false),
  relevanceScore: int("relevanceScore"), // 0-100 relevance to case
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  accountIdIdx: index("account_id_idx").on(table.accountId),
  caseIdIdx: index("case_id_idx").on(table.caseId),
  threadIdIdx: index("thread_id_idx").on(table.threadId),
  lastMessageDateIdx: index("last_message_date_idx").on(table.lastMessageDate),
}));

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = typeof emailThreads.$inferInsert;

// Email sync jobs (track sync progress)
export const emailSyncJobs = mysqlTable("email_sync_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  accountId: varchar("accountId", { length: 64 }).notNull(),
  caseId: varchar("caseId", { length: 64 }), // Optional: sync for specific case
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  startDate: timestamp("startDate"), // Filter: fetch emails from this date
  endDate: timestamp("endDate"), // Filter: fetch emails until this date
  keywords: text("keywords"), // JSON array of search keywords
  totalMessages: int("totalMessages").default(0),
  processedMessages: int("processedMessages").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  accountIdIdx: index("account_id_idx").on(table.accountId),
  caseIdIdx: index("case_id_idx").on(table.caseId),
  statusIdx: index("status_idx").on(table.status),
}));

export type EmailSyncJob = typeof emailSyncJobs.$inferSelect;
export type InsertEmailSyncJob = typeof emailSyncJobs.$inferInsert;

