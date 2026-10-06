CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discogs_artist_id` integer,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artists_discogs_artist_id_unique` ON `artists` (`discogs_artist_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `artists_name_lower_idx` ON `artists` (lower("name"));--> statement-breakpoint
CREATE TABLE `record_artists` (
	`record_id` integer NOT NULL,
	`artist_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`record_id`, `position`),
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `record_artists_artist_idx` ON `record_artists` (`artist_id`);--> statement-breakpoint
CREATE TABLE `record_tags` (
	`record_id` integer NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`record_id`, `kind`, `name`),
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `record_tags_kind_name_idx` ON `record_tags` (`kind`,`name`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discogs_release_id` integer,
	`title` text NOT NULL,
	`year` integer,
	`label` text,
	`catalog_number` text,
	`format` text,
	`cover_image_url` text,
	`runtime_seconds` integer,
	`media_condition` text,
	`sleeve_condition` text,
	`notes` text,
	`added_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_discogs_release_id_unique` ON `records` (`discogs_release_id`);--> statement-breakpoint
CREATE INDEX `records_added_at_idx` ON `records` (`added_at`);