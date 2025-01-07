DROP INDEX IF EXISTS "repo_last_updated_idx";--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "issues_last_updated_at" timestamp (6) with time zone;
