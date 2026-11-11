CREATE TABLE `osm_places` (
	`osm_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`opening_hours` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shelter_id` integer NOT NULL,
	`kind` text NOT NULL,
	`note` text,
	`hours_seen` text,
	`created_at` integer NOT NULL,
	`client_hash` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`shelter_id`) REFERENCES `shelters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_shelter_idx` ON `reports` (`shelter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_client_idx` ON `reports` (`client_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `shelter_hosts` (
	`shelter_id` integer PRIMARY KEY NOT NULL,
	`osm_id` text NOT NULL,
	`distance_m` integer NOT NULL,
	`score` real NOT NULL,
	`matched_at` integer NOT NULL,
	FOREIGN KEY (`shelter_id`) REFERENCES `shelters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`osm_id`) REFERENCES `osm_places`(`osm_id`) ON UPDATE no action ON DELETE no action
);
