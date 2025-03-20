CREATE INDEX IF NOT EXISTS "user_status_idx" ON "users_to_repos" USING btree ("user_id","status","subscribed_at" DESC NULLS LAST);