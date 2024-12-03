ALTER TABLE "repos" ADD COLUMN "is_syncing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "last_synced_at" timestamp (6) with time zone;