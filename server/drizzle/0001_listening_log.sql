CREATE TABLE `spin_tracks` (
	`spin_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	PRIMARY KEY(`spin_id`, `track_id`),
	FOREIGN KEY (`spin_id`) REFERENCES `spins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spin_tracks_track_idx` ON `spin_tracks` (`track_id`);--> statement-breakpoint
CREATE TABLE `spins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer NOT NULL,
	`played_at` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`sides` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spins_played_at_idx` ON `spins` (`played_at`);--> statement-breakpoint
CREATE INDEX `spins_record_idx` ON `spins` (`record_id`,`played_at`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer NOT NULL,
	`position` text NOT NULL,
	`side` text,
	`title` text NOT NULL,
	`duration_seconds` integer,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tracks_record_idx` ON `tracks` (`record_id`,`sort_order`);