CREATE TABLE `designs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`design_id` text NOT NULL,
	`number` integer NOT NULL,
	`html` text NOT NULL,
	`author` text NOT NULL,
	`role` text NOT NULL,
	`notes` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text DEFAULT 'In review' NOT NULL,
	FOREIGN KEY (`design_id`) REFERENCES `designs`(`id`) ON UPDATE no action ON DELETE no action
);
