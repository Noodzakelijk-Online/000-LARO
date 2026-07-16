ALTER TABLE `lawyers` ADD `officialProfileUrl` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `officialLegalAreas` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `specializationAssociations` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `admissionDate` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `district` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `financedLegalAid` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `directorySource` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `directoryRetrievedAt` integer;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `directoryDistanceKm` text;--> statement-breakpoint
ALTER TABLE `lawyers` ADD `directorySearchLocation` text;--> statement-breakpoint
CREATE INDEX `lawyers_novaId_idx` ON `lawyers` (`novaId`);
