CREATE TABLE `outreach_directory_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`targetType` text NOT NULL,
	`name` text NOT NULL,
	`subtype` text,
	`description` text,
	`topics` text,
	`legalAreas` text,
	`audience` text,
	`channels` text,
	`region` text,
	`url` text NOT NULL,
	`contactUrl` text,
	`sourceUrl` text,
	`sourceLabel` text,
	`sourceRetrievedAt` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`confidence` text DEFAULT 'discovery_candidate' NOT NULL,
	`reviewNotes` text,
	`reviewedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_targets_user_type_url_unique` ON `outreach_directory_targets` (`userId`,`targetType`,`url`);--> statement-breakpoint
CREATE INDEX `outreach_targets_user_type_status_idx` ON `outreach_directory_targets` (`userId`,`targetType`,`status`);--> statement-breakpoint
CREATE TABLE `case_outreach_target_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`caseId` text NOT NULL,
	`targetId` text NOT NULL,
	`targetType` text NOT NULL,
	`matchScore` integer NOT NULL,
	`scoreBreakdown` text NOT NULL,
	`matchReasons` text NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`targetId`) REFERENCES `outreach_directory_targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_outreach_matches_case_target_unique` ON `case_outreach_target_matches` (`caseId`,`targetId`);--> statement-breakpoint
CREATE INDEX `case_outreach_matches_user_case_type_idx` ON `case_outreach_target_matches` (`userId`,`caseId`,`targetType`);
