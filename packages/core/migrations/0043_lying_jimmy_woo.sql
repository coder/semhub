CREATE INDEX IF NOT EXISTS "installations_active_idx" ON "installations" USING btree ("uninstalled_at","suspended_at") WHERE "installations"."uninstalled_at" IS NULL AND "installations"."suspended_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_idx" ON "users" USING btree ("email");
