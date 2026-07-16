CREATE TABLE `document_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`evidenceId` text NOT NULL,
	`caseId` text NOT NULL,
	`userId` text NOT NULL,
	`analysisVersion` text NOT NULL,
	`contentHash` text NOT NULL,
	`status` text NOT NULL,
	`extractionMethod` text NOT NULL,
	`providerStatus` text NOT NULL,
	`documentType` text NOT NULL,
	`confidence` integer NOT NULL,
	`summary` text NOT NULL,
	`result` text NOT NULL,
	`analyzedChars` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`evidenceId`) REFERENCES `evidence`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_analyses_evidence_version_unique` ON `document_analyses` (`evidenceId`,`analysisVersion`);--> statement-breakpoint
CREATE INDEX `document_analyses_case_created_idx` ON `document_analyses` (`caseId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `document_analyses_user_idx` ON `document_analyses` (`userId`);
