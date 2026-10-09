CREATE TABLE `styluses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`rated_hours` integer NOT NULL,
	`initial_hours` integer DEFAULT 0 NOT NULL,
	`installed_at` text NOT NULL,
	`retired_at` text
);
--> statement-breakpoint
CREATE INDEX `styluses_installed_at_idx` ON `styluses` (`installed_at`);