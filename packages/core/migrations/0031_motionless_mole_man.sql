DROP INDEX IF EXISTS "issue_updated_at_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_last_updated_idx" ON "issues" USING btree ("repo_id","issue_updated_at" DESC NULLS LAST);