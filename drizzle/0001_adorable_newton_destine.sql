CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`meetup_id` text NOT NULL,
	`target_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`reason` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meetup_id`) REFERENCES `meetups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_claim_per_guest` ON `claims` (`meetup_id`,`target_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`meetup_id` text NOT NULL,
	`amount` integer NOT NULL,
	`memo` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meetup_id`) REFERENCES `meetups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`meetup_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payment` text DEFAULT 'unpaid' NOT NULL,
	`provider` text,
	`payment_ref` text,
	`checked_at` text,
	FOREIGN KEY (`meetup_id`) REFERENCES `meetups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_guest` ON `guests` (`meetup_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `meetups` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`starts_at` text NOT NULL,
	`amount` integer NOT NULL,
	`code` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meetups_code_unique` ON `meetups` (`code`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`agree` integer NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voter_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_vote` ON `votes` (`claim_id`,`voter_id`);