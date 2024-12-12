DO $$ BEGIN
 CREATE TYPE "public"."embedding_sync_status" AS ENUM('ready', 'in_progress', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."init_status" AS ENUM('ready', 'in_progress', 'completed', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sync_status" AS ENUM('ready', 'queued', 'in_progress', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "embedding_sync_status" "embedding_sync_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "sync_status" "sync_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "init_status" "init_status" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "initialized_at" timestamp (6) with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_updated_at_idx" ON "issues" USING btree ("issue_updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embedding_null_idx" ON "issues" USING btree ("repo_id") WHERE "issues"."embedding" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "created_at_idx" ON "repos" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "repos" DROP COLUMN IF EXISTS "is_syncing";--> statement-breakpoint
ALTER TABLE "repos" DROP COLUMN IF EXISTS "issues_last_updated_at";--> statement-breakpoint
UPDATE "repos"
SET "initialized_at" = NOW(),
    "init_status" = 'completed'
WHERE "initialized_at" IS NULL;
