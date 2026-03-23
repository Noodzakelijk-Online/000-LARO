-- LARO Complete Database Schema
-- Run this against laro_db to create all tables
-- Compatible with MySQL 8.0

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320) DEFAULT NULL,
  `loginMethod` varchar(64) DEFAULT NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `stripeCustomerId` varchar(128) DEFAULT NULL,
  `stripeSubscriptionId` varchar(128) DEFAULT NULL,
  `subscriptionStatus` enum('free','active','past_due','canceled','trialing') DEFAULT 'free',
  `subscriptionTier` enum('free','pro','enterprise') DEFAULT 'free',
  `emailPreferences` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Lawyers ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `lawyers` (
  `id` varchar(64) NOT NULL,
  `name` varchar(512) DEFAULT NULL,
  `city` varchar(256) DEFAULT NULL,
  `firm` varchar(512) DEFAULT NULL,
  `firmName` varchar(512) DEFAULT NULL,
  `legalAreas` text,
  `email` varchar(320) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `website` varchar(512) DEFAULT NULL,
  `permanentlyFiltered` varchar(8) DEFAULT NULL,
  `filterUntil` timestamp NULL DEFAULT NULL,
  -- Extra columns used in matching algorithm
  `totalOutreaches` varchar(32) DEFAULT '0',
  `totalResponses` varchar(32) DEFAULT '0',
  `totalAcceptances` varchar(32) DEFAULT '0',
  `averageResponseTimeHours` varchar(32) DEFAULT NULL,
  `caseLoad` varchar(32) DEFAULT NULL,
  `caseStop` varchar(8) DEFAULT 'No',
  `barAssociationStatus` varchar(128) DEFAULT 'Good Standing',
  `currentlyAccepting` varchar(8) DEFAULT 'Yes',
  `experienceYears` varchar(32) DEFAULT '0',
  `latitude` varchar(32) DEFAULT NULL,
  `longitude` varchar(32) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lawyers_city_idx` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Cases ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `cases` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) NOT NULL,
  `clientName` varchar(512) DEFAULT NULL,
  `clientEmail` varchar(320) DEFAULT NULL,
  `clientPhone` varchar(64) DEFAULT NULL,
  `clientAddress` text DEFAULT NULL,
  `caseType` varchar(256) DEFAULT NULL,
  `caseSummary` text,
  `urgency` varchar(32) DEFAULT NULL,
  `status` varchar(64) DEFAULT 'active',
  `legalAreas` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cases_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Evidence ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `evidence` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) NOT NULL,
  `userId` varchar(64) NOT NULL,
  `type` enum('document','email','chat','photo','video','audio','other') NOT NULL,
  `source` varchar(128) DEFAULT NULL,
  `title` varchar(512) NOT NULL,
  `description` text,
  `fileUrl` text,
  `fileName` varchar(512) DEFAULT NULL,
  `fileSize` varchar(32) DEFAULT NULL,
  `mimeType` varchar(128) DEFAULT NULL,
  `metadata` text,
  `tags` text,
  `relevant` tinyint(1) DEFAULT 1,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `evidence_caseId_idx` (`caseId`),
  KEY `evidence_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `evidence_items` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `title` varchar(512) DEFAULT NULL,
  `source` varchar(128) DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `evidence_sources` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `provider` varchar(64) DEFAULT NULL,
  `sourceType` varchar(64) DEFAULT NULL,
  `externalId` varchar(256) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `accessToken` text,
  `itemsCollected` int DEFAULT NULL,
  `lastSyncedAt` timestamp NULL DEFAULT NULL,
  `connectedAt` timestamp NULL DEFAULT NULL,
  `errorMessage` text,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `evidence_files` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) NOT NULL,
  `fileType` varchar(128) DEFAULT NULL,
  `fileSize` varchar(32) DEFAULT NULL,
  `uploadSource` enum('manual','agent') DEFAULT 'manual',
  `uploadedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fileName` varchar(512) DEFAULT NULL,
  `mimeType` varchar(128) DEFAULT NULL,
  `storageKey` text,
  PRIMARY KEY (`id`),
  KEY `evidence_files_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `evidence_tags` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `color` varchar(32) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `evidence_file_tags` (
  `id` varchar(64) NOT NULL,
  `evidenceFileId` varchar(64) DEFAULT NULL,
  `tagId` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Outreach ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `outreach_status` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `lawyerId` varchar(64) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `initialContact` timestamp NULL DEFAULT NULL,
  `lastContact` timestamp NULL DEFAULT NULL,
  `followUpsSent` int DEFAULT 0,
  `followUp1SentAt` timestamp NULL DEFAULT NULL,
  `followUp2SentAt` timestamp NULL DEFAULT NULL,
  `responseTimeHours` varchar(32) DEFAULT NULL,
  `lawyerCapacityPercentage` varchar(32) DEFAULT NULL,
  `acceptanceStatus` varchar(64) DEFAULT NULL,
  `response` text,
  `notes` text,
  `distanceKm` varchar(32) DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Email ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `email_accounts` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) NOT NULL,
  `provider` varchar(64) DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `accessToken` text,
  `refreshToken` text,
  `tokenExpiry` timestamp NULL DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `connectedAt` timestamp NULL DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_sync_jobs` (
  `id` varchar(64) NOT NULL,
  `accountId` varchar(64) DEFAULT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `startDate` timestamp NULL DEFAULT NULL,
  `endDate` timestamp NULL DEFAULT NULL,
  `keywords` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_messages` (
  `id` varchar(64) NOT NULL,
  `accountId` varchar(64) DEFAULT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `category` varchar(64) DEFAULT NULL,
  `relevanceScore` varchar(32) DEFAULT NULL,
  `subject` text,
  `body` text,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_activity` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `lawyerId` varchar(64) DEFAULT NULL,
  `activityType` varchar(64) DEFAULT NULL,
  `sentAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `responseReceived` varchar(8) DEFAULT 'No',
  `responseStatus` varchar(64) DEFAULT 'No Response',
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Messages & comms ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `messages` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `content` text,
  `threadId` varchar(64) DEFAULT NULL,
  `parentId` varchar(64) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `communications` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `channel` varchar(64) DEFAULT NULL,
  `body` text,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `title` varchar(512) DEFAULT NULL,
  `content` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Billing ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `billing_periods` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `stripeSubscriptionId` varchar(128) DEFAULT NULL,
  `periodStart` timestamp NULL DEFAULT NULL,
  `periodEnd` timestamp NULL DEFAULT NULL,
  `totalCost` varchar(32) DEFAULT '0',
  `metadata` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `usage_tracking` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `resourceType` varchar(128) DEFAULT NULL,
  `quantity` varchar(32) DEFAULT NULL,
  `baseCost` varchar(32) DEFAULT NULL,
  `billedCost` varchar(32) DEFAULT NULL,
  `metadata` text,
  `caseId` varchar(64) DEFAULT NULL,
  `reportedToStripe` tinyint(1) DEFAULT 0,
  `stripeUsageRecordId` varchar(128) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `usage_limits` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `tier` varchar(64) DEFAULT NULL,
  `resourceType` varchar(128) DEFAULT NULL,
  `monthlyLimit` varchar(32) DEFAULT NULL,
  `description` text,
  `limitsJson` text,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Integrations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `google_drive_files` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `accountId` varchar(64) DEFAULT NULL,
  `googleFileId` varchar(256) DEFAULT NULL,
  `fileName` varchar(512) DEFAULT NULL,
  `mimeType` varchar(256) DEFAULT NULL,
  `fileSize` varchar(64) DEFAULT NULL,
  `s3Key` text,
  `s3Url` text,
  `googleWebViewLink` text,
  `googleModifiedTime` timestamp NULL DEFAULT NULL,
  `evidenceType` varchar(64) DEFAULT NULL,
  `isIncluded` varchar(8) DEFAULT NULL,
  `relevanceScore` varchar(32) DEFAULT NULL,
  `category` varchar(128) DEFAULT NULL,
  `userNotes` text,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── System & config ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `system_config` (
  `key` varchar(128) NOT NULL,
  `configKey` varchar(128) DEFAULT NULL,
  `value` text,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `clarification_questions` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `question` text,
  `answer` text,
  `status` varchar(64) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `saved_searches` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) NOT NULL,
  `name` varchar(256) DEFAULT NULL,
  `queryJson` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) NOT NULL,
  `key` varchar(128) DEFAULT NULL,
  `value` text,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `message_templates` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `body` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `title` varchar(512) DEFAULT NULL,
  `body` text,
  `read` tinyint(1) DEFAULT 0,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `action` varchar(128) DEFAULT NULL,
  `resource` varchar(128) DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bulk_import_jobs` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `filename` varchar(256) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `totalRows` varchar(16) DEFAULT '0',
  `processedRows` varchar(16) DEFAULT '0',
  `failedRows` varchar(16) DEFAULT '0',
  `errors` text,
  `completedAt` timestamp NULL DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  
CREATE TABLE IF NOT EXISTS `extracted_entities` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `entityType` varchar(64) DEFAULT NULL,
  `value` text,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Lawyer ratings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `lawyer_ratings` (
  `id` varchar(64) NOT NULL,
  `lawyerId` varchar(64) DEFAULT NULL,
  `overallRating` varchar(32) DEFAULT NULL,
  `metadata` text,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lawyer_interactions` (
  `id` varchar(64) NOT NULL,
  `lawyerId` varchar(64) DEFAULT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `interactionType` varchar(64) DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rating_calculation_logs` (
  `id` varchar(64) NOT NULL,
  `lawyerId` varchar(64) DEFAULT NULL,
  `log` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Gap analysis & timeline ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `communication_gaps` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `data` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `expected_documents` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `data` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `suspicious_patterns` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `data` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `legal_inferences` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `data` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `case_strength_analysis` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `data` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `timeline` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `eventType` varchar(64) DEFAULT NULL,
  `title` varchar(512) DEFAULT NULL,
  `description` text,
  `eventAt` timestamp NULL DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Auto-collection & unified inbox ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `auto_collection_settings` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `keywords` text,
  `metadata` text,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `auto_collection_logs` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `message` text,
  `level` varchar(32) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `keyword_matches` (
  `id` varchar(64) NOT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `keyword` varchar(256) DEFAULT NULL,
  `source` varchar(64) DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `unified_messages` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `threadId` varchar(64) DEFAULT NULL,
  `channel` varchar(64) DEFAULT NULL,
  `body` text,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `conversation_threads` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `title` varchar(512) DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `channel_integrations` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `provider` varchar(64) DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Agent devices ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `agent_devices` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `deviceName` varchar(256) DEFAULT NULL,
  `platform` varchar(64) DEFAULT NULL,
  `status` varchar(64) DEFAULT 'active',
  `lastSeen` timestamp NULL DEFAULT NULL,
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agent_scans` (
  `id` varchar(64) NOT NULL,
  `deviceId` varchar(64) DEFAULT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `caseId` varchar(64) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `totalFiles` varchar(32) DEFAULT '0',
  `uploadedFiles` varchar(32) DEFAULT '0',
  `failedFiles` varchar(32) DEFAULT '0',
  `metadata` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET foreign_key_checks = 1;

-- Verify tables created
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = DATABASE();