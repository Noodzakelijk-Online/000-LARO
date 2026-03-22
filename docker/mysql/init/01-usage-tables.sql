-- Runs once on first MySQL data volume init only.
USE laro_db;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usage_tracking` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) DEFAULT NULL,
  `resourceType` varchar(128) DEFAULT NULL,
  `quantity` varchar(32) DEFAULT NULL,
  `baseCost` varchar(32) DEFAULT NULL,
  `billedCost` varchar(32) DEFAULT NULL,
  `metadata` text,
  `caseId` varchar(64) DEFAULT NULL,
  `reportedToStripe` tinyint(1) NOT NULL DEFAULT 0,
  `stripeUsageRecordId` varchar(128) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
