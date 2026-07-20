CREATE TABLE `keyword_pull_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`caseId` text NOT NULL,
	`userId` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`phase` text DEFAULT 'queued' NOT NULL,
	`message` text DEFAULT 'Waiting to start' NOT NULL,
	`processedWords` integer DEFAULT 0 NOT NULL,
	`totalWords` integer DEFAULT 0 NOT NULL,
	`processedItems` integer DEFAULT 0 NOT NULL,
	`totalItems` integer DEFAULT 0 NOT NULL,
	`estimatedSecondsRemaining` integer,
	`result` text,
	`error` text,
	`createdAt` integer NOT NULL,
	`startedAt` integer,
	`updatedAt` integer NOT NULL,
	`completedAt` integer,
	FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `keyword_pull_jobs_user_case_created_idx` ON `keyword_pull_jobs` (`userId`,`caseId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `keyword_pull_jobs_user_status_idx` ON `keyword_pull_jobs` (`userId`,`status`);
