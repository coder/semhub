DO $$ BEGIN
 CREATE TYPE "public"."issue_embedding_sync_status" AS ENUM('ready', 'in_progress', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"issue_id" text NOT NULL,
	"embedding_model" text,
	"embedding" vector(1536),
	"embedding_generated_at" timestamp (6) with time zone,
	"issue_embedding_sync_status" "issue_embedding_sync_status" DEFAULT 'ready' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issue_embeddings" ADD CONSTRAINT "issue_embeddings_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_embeddings_issue_id_idx" ON "issue_embeddings" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_embeddings_embedding_idx" ON "issue_embeddings" USING hnsw ("embedding" vector_cosine_ops);
