CREATE TABLE `legacy_import_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`sourceRuntime` text NOT NULL,
	`sourceInstanceId` text NOT NULL,
	`userId` text NOT NULL,
	`sourceUserId` text NOT NULL,
	`sourceUserEmail` text,
	`status` text NOT NULL,
	`sourceSnapshotHash` text NOT NULL,
	`recordsImported` integer NOT NULL,
	`casesImported` integer NOT NULL,
	`filesCopied` integer NOT NULL,
	`missingFiles` integer NOT NULL,
	`summary` text NOT NULL,
	`startedAt` integer NOT NULL,
	`completedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_import_runs_source_user_unique` ON `legacy_import_runs` (`sourceRuntime`,`sourceInstanceId`,`userId`);
--> statement-breakpoint
CREATE INDEX `legacy_import_runs_user_completed_idx` ON `legacy_import_runs` (`userId`,`completedAt`);
--> statement-breakpoint
CREATE TABLE `legacy_import_records` (
	`id` text PRIMARY KEY NOT NULL,
	`runId` text NOT NULL,
	`userId` text NOT NULL,
	`caseId` text,
	`sourceRuntime` text NOT NULL,
	`sourceInstanceId` text NOT NULL,
	`sourceTable` text NOT NULL,
	`sourceRecordId` text NOT NULL,
	`sourceHash` text NOT NULL,
	`payloadHash` text NOT NULL,
	`redactedFields` text NOT NULL,
	`payload` text NOT NULL,
	`importedAt` integer NOT NULL,
	FOREIGN KEY (`runId`) REFERENCES `legacy_import_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_import_records_source_unique` ON `legacy_import_records` (`sourceRuntime`,`sourceInstanceId`,`sourceTable`,`sourceRecordId`,`userId`);
--> statement-breakpoint
CREATE INDEX `legacy_import_records_run_table_idx` ON `legacy_import_records` (`runId`,`sourceTable`);
--> statement-breakpoint
CREATE INDEX `legacy_import_records_user_case_idx` ON `legacy_import_records` (`userId`,`caseId`);
