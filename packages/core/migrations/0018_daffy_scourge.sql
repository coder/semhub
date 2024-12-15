DROP INDEX IF EXISTS "issue_state_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_state_open_idx" ON "issues" USING btree ("issue_state") WHERE issue_state = 'OPEN';