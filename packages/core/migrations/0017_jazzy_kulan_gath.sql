DROP INDEX IF EXISTS "embeddingIndex";--> statement-breakpoint
DROP INDEX IF EXISTS "embedding_null_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "embedding_update_check_idx";--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "embedding_model";--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "embedding";--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "embedding_created_at";--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN IF EXISTS "embedding_sync_status";