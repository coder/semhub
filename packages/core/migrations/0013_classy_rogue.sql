CREATE INDEX IF NOT EXISTS "embedding_update_check_idx" ON "issues" USING btree ("embedding_created_at","issue_updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_sync_idx" ON "repos" USING btree ("init_status","sync_status","last_synced_at" NULLS FIRST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_init_idx" ON "repos" USING btree ("init_status","created_at");