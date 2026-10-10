DROP TABLE `settings`;--> statement-breakpoint
DROP INDEX `records_discogs_release_id_unique`;--> statement-breakpoint
ALTER TABLE `records` ADD `user_id` integer REFERENCES users(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `records_user_idx` ON `records` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_user_release_idx` ON `records` (`user_id`,`discogs_release_id`);--> statement-breakpoint
ALTER TABLE `styluses` ADD `user_id` integer REFERENCES users(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `styluses_user_idx` ON `styluses` (`user_id`);