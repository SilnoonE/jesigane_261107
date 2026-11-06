ALTER TABLE `guests` ADD `nickname` text;--> statement-breakpoint
CREATE UNIQUE INDEX `one_room_nickname` ON `guests` (`meetup_id`,`nickname`);