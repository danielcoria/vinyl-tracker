CREATE TABLE `lastfm_accounts` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`session_key` text NOT NULL,
	`connected_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `spins` ADD `scrobble_state` text;