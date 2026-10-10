CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL,
	`payload_hash` text NOT NULL,
	`score` integer NOT NULL,
	`premium` integer NOT NULL,
	`priority` text NOT NULL,
	`reasons` text NOT NULL,
	`sheet_status` text DEFAULT 'pending' NOT NULL,
	`sheet_error` text,
	`status` text DEFAULT 'New' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
