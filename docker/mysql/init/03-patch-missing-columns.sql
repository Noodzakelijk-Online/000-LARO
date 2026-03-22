-- LARO Schema Patch — adds ALL missing columns referenced by routers
-- Safe to run multiple times (uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
-- Place in docker/mysql/init/03-patch-missing-columns.sql

-- ─── cases — needs metadata for deadlines/communications storage ─────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS metadata     text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clientPhone  varchar(64)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clientAddress text        DEFAULT NULL;

-- ─── messages — needs full messaging columns ─────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS lawyerId     varchar(64)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subject      text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS body         text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS direction    varchar(16)  DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS status       varchar(32)  DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS priority     varchar(16)  DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS sentAt       timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS readAt       timestamp    NULL DEFAULT NULL;

-- ─── message_templates — needs category/subject ──────────────────────────────
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS category     varchar(64)  DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS subject      text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS language     varchar(16)  DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS isDefault    tinyint(1)   DEFAULT 0;

-- ─── billing_periods — needs totalCost ───────────────────────────────────────
ALTER TABLE billing_periods
  ADD COLUMN IF NOT EXISTS totalCost    varchar(32)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS status       varchar(32)  DEFAULT 'active';

-- ─── lawyers — needs enrichment + matching algorithm columns ─────────────────
ALTER TABLE lawyers
  ADD COLUMN IF NOT EXISTS totalOutreaches          varchar(32)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS totalResponses           varchar(32)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS totalAcceptances         varchar(32)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS averageResponseTimeHours varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS caseLoad                 varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS caseStop                 varchar(8)   DEFAULT 'No',
  ADD COLUMN IF NOT EXISTS barAssociationStatus     varchar(128) DEFAULT 'Good Standing',
  ADD COLUMN IF NOT EXISTS currentlyAccepting       varchar(8)   DEFAULT 'Yes',
  ADD COLUMN IF NOT EXISTS experienceYears          varchar(32)  DEFAULT '0',
  ADD COLUMN IF NOT EXISTS latitude                 varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude                varchar(32)  DEFAULT NULL;

-- ─── outreach_status — needs full outreach tracking ──────────────────────────
ALTER TABLE outreach_status
  ADD COLUMN IF NOT EXISTS initialContact           timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lastContact              timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS followUpsSent            int          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followUp1SentAt          timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS followUp2SentAt          timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS responseTimeHours        varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lawyerCapacityPercentage varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS acceptanceStatus         varchar(64)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response                 text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes                    text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS distanceKm               varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS createdAt                timestamp    NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── email_activity — needs response tracking ─────────────────────────────────
ALTER TABLE email_activity
  ADD COLUMN IF NOT EXISTS sentAt           timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS responseReceived varchar(8)   DEFAULT 'No',
  ADD COLUMN IF NOT EXISTS responseStatus   varchar(64)  DEFAULT 'No Response';

-- ─── system_config — needs configKey alias ───────────────────────────────────
ALTER TABLE system_config
  ADD COLUMN IF NOT EXISTS configKey varchar(128) DEFAULT NULL;

-- ─── lawyer_interactions — needs response time tracking ──────────────────────
ALTER TABLE lawyer_interactions
  ADD COLUMN IF NOT EXISTS responseTimeHours    varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS outreachSentAt       timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS responseReceivedAt   timestamp    NULL DEFAULT NULL;

-- ─── clarification_questions — needs priority + timestamps ───────────────────
ALTER TABLE clarification_questions
  ADD COLUMN IF NOT EXISTS priority     varchar(16)  DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS context      text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS askedAt      timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS answeredAt   timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dismissedAt  timestamp    NULL DEFAULT NULL;

-- ─── unified_messages — needs full messaging columns ─────────────────────────
ALTER TABLE unified_messages
  ADD COLUMN IF NOT EXISTS subject          text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sender           varchar(320) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recipient        varchar(320) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS direction        varchar(16)  DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS status           varchar(32)  DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS priority         varchar(16)  DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS externalId       varchar(256) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachmentCount  int          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sentAt           timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS receivedAt       timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS readAt           timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS caseId           varchar(64)  DEFAULT NULL;

-- ─── conversation_threads — needs status + activity tracking ─────────────────
ALTER TABLE conversation_threads
  ADD COLUMN IF NOT EXISTS status           varchar(32)  DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS channel          varchar(64)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lastMessageAt    timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS messageCount     int          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unreadCount      int          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS caseId           varchar(64)  DEFAULT NULL;

-- ─── evidence_sources — needs oauth token columns ────────────────────────────
ALTER TABLE evidence_sources
  ADD COLUMN IF NOT EXISTS refreshToken     text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tokenExpiry      timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accountId        varchar(64)  DEFAULT NULL;

-- ─── evidence_files — needs title and relevance scoring ──────────────────────
ALTER TABLE evidence_files
  ADD COLUMN IF NOT EXISTS title            varchar(512) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description      text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS relevanceScore   varchar(32)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tags             text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS s3Key            text         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS s3Url            text         DEFAULT NULL;

-- ─── auto_collection_settings — needs schedule config ────────────────────────
ALTER TABLE auto_collection_settings
  ADD COLUMN IF NOT EXISTS enabled          tinyint(1)   DEFAULT 1,
  ADD COLUMN IF NOT EXISTS frequency        varchar(32)  DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS lastRunAt        timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nextRunAt        timestamp    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sources          text         DEFAULT NULL;

SELECT CONCAT('Schema patch complete. Tables updated at: ', NOW()) as status;