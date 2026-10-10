CREATE TABLE `confirmation_emails` (
	`lead_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`first_attempt_at` integer,
	`last_attempt_at` integer,
	`provider_id` text,
	`accepted_at` text,
	`error` text
);
