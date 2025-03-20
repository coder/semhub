DO $$ BEGIN
 CREATE TYPE "public"."issue_state" AS ENUM('OPEN', 'CLOSED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."issue_state_reason" AS ENUM('COMPLETED', 'REOPENED', 'NOT_PLANNED', 'DUPLICATE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"issue_id" text NOT NULL,
	"node_id" text NOT NULL,
	"author" jsonb,
	"body" text NOT NULL,
	"comment_created_at" timestamp (6) with time zone NOT NULL,
	"comment_updated_at" timestamp (6) with time zone NOT NULL,
	CONSTRAINT "comments_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"repo_id" text NOT NULL,
	"node_id" text NOT NULL,
	"number" integer NOT NULL,
	"author" jsonb,
	"issue_state" "issue_state" NOT NULL,
	"issue_state_reason" "issue_state_reason",
	"html_url" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"labels" jsonb,
	"issue_created_at" timestamp (6) with time zone NOT NULL,
	"issue_updated_at" timestamp (6) with time zone NOT NULL,
	"issue_closed_at" timestamp (6) with time zone,
	CONSTRAINT "issues_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "repos" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"node_id" text NOT NULL,
	"html_url" text NOT NULL,
	"is_private" boolean NOT NULL,
	"issues_last_updated_at" timestamp (6) with time zone,
	CONSTRAINT "repos_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues" ADD CONSTRAINT "issues_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_id_idx" ON "issues" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "owner_name_idx" ON "repos" USING btree ("owner","name");