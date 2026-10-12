CREATE TABLE `price_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer NOT NULL,
	`captured_at` text NOT NULL,
	`lowest_price` real,
	`currency` text,
	`num_for_sale` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_snapshots_record_idx` ON `price_snapshots` (`record_id`,`captured_at`);