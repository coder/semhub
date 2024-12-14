TRUNCATE TABLE "issue_embeddings";--> statement-breakpoint
DROP INDEX IF EXISTS "issue_embeddings_issue_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issue_embeddings_issue_id_idx" ON "issue_embeddings" USING btree ("issue_id");
