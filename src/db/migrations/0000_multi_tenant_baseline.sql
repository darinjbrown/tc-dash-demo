CREATE TABLE `access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`company` text NOT NULL,
	`note` text,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`transaction_id` text,
	`user_id` text,
	`action` text NOT NULL,
	`details` text,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_log_tenant_idx` ON `activity_log` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`broker` text,
	`license_number` text,
	`brokerage_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_in_house` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agents_tenant_idx` ON `agents` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_template_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`transaction_type` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_template_groups_tenant_idx` ON `task_template_groups` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`template_group_id` text,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`transaction_type` text DEFAULT 'both',
	`relative_due_days` integer NOT NULL,
	`relative_to` text DEFAULT 'acceptance_date' NOT NULL,
	`sort_order` integer NOT NULL,
	`is_required` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_group_id`) REFERENCES `task_template_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_templates_tenant_idx` ON `task_templates` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenant_branding` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`logo_url` text,
	`logo_dark_url` text,
	`logo_icon_url` text,
	`colors` text NOT NULL,
	`dark_colors` text,
	`border_radius` text DEFAULT '0.5rem' NOT NULL,
	`font_family` text,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`billing_status` text DEFAULT 'manual' NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `transaction_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`side` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_agents_tenant_idx` ON `transaction_agents` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `transaction_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`template_id` text,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`due_date` text,
	`completed_date` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`assigned_to` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`notes` text,
	`sort_order` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_tasks_tenant_idx` ON `transaction_tasks` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`address` text NOT NULL,
	`city` text,
	`state` text DEFAULT 'CA',
	`zip_code` text,
	`mls_number` text,
	`seller_tc_name` text,
	`seller_tc_email` text,
	`seller_tc_phone` text,
	`buyer_tc_name` text,
	`buyer_tc_email` text,
	`buyer_tc_phone` text,
	`transaction_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`property_type` text,
	`escrow_number` text,
	`escrow_company` text,
	`escrow_officer` text,
	`escrow_officer_phone` text,
	`escrow_officer_email` text,
	`lender_name` text,
	`loan_officer` text,
	`loan_officer_phone` text,
	`loan_officer_email` text,
	`buyer_name` text,
	`seller_name` text,
	`purchase_price` integer,
	`earnest_money_deposit` integer,
	`buyer_commission_percent` text,
	`listing_commission_percent` text,
	`contract_date` text,
	`acceptance_date` text,
	`verification_of_funds_date` text,
	`earnest_money_due_date` text,
	`inspection_contingency_date` text,
	`insurance_contingency_date` text,
	`loan_contingency_date` text,
	`appraisal_contingency_date` text,
	`hoa_docs_due_date` text,
	`listing_active_date` text,
	`expected_close_date` text,
	`actual_close_date` text,
	`notes` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_tenant_idx` ON `transactions` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`hashed_password` text,
	`role` text DEFAULT 'tc' NOT NULL,
	`tenant_id` text,
	`is_platform_admin` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
