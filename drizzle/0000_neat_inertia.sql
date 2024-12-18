CREATE TABLE `bluesky_fwd_post` (
	`did` text,
	`rkey` text,
	`tg_chat_id` integer NOT NULL,
	`telegram_msg_ids` text NOT NULL,
	PRIMARY KEY(`did`, `rkey`)
);
--> statement-breakpoint
CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
