CREATE EXTENSION vector;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "embedding_created_at" timestamp (6) with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embeddingIndex" ON "issues" USING hnsw ("embedding" vector_cosine_ops);
