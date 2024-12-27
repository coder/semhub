ALTER TABLE "installations_to_repos" ALTER COLUMN "github_repo_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "target_github_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "installations" ADD COLUMN "target_node_id" text NOT NULL;