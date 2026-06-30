ALTER TABLE `activity_log` ADD `actor_is_platform_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_log` ADD `actor_label` text;