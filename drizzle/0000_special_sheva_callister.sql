CREATE TABLE `shelter_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shelter_id` integer NOT NULL,
	`sync_run_id` integer NOT NULL,
	`kind` text NOT NULL,
	`diff` text,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shelter_id`) REFERENCES `shelters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sync_run_id`) REFERENCES `sync_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shelter_changes_shelter_idx` ON `shelter_changes` (`shelter_id`);--> statement-breakpoint
CREATE TABLE `shelters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_object_id` integer NOT NULL,
	`name` text,
	`operator` text,
	`notes` text,
	`county` text,
	`municipality` text,
	`eldership` text,
	`settlement` text,
	`street` text,
	`house_number` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`lks_x` real,
	`lks_y` real,
	`capacity` integer,
	`area_m2` real,
	`hours_raw` text,
	`access_24h` integer,
	`signposted` integer,
	`accessible` integer,
	`lighting` integer,
	`toilets` integer,
	`ventilation` integer,
	`also_collective_protection` integer,
	`source_updated_at` integer,
	`source_published_at` integer,
	`fingerprint` text NOT NULL,
	`raw` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`removed_at` integer
);
--> statement-breakpoint
CREATE INDEX `shelters_active_idx` ON `shelters` (`removed_at`);--> statement-breakpoint
CREATE INDEX `shelters_municipality_idx` ON `shelters` (`municipality`);--> statement-breakpoint
CREATE INDEX `shelters_latlng_idx` ON `shelters` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`source_published_at` integer,
	`fetched` integer,
	`added` integer,
	`updated` integer,
	`removed` integer,
	`restored` integer,
	`unchanged` integer,
	`error` text
);
