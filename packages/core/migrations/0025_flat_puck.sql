DO $$ BEGIN
 CREATE TYPE "public"."repository_selection" AS ENUM('all', 'selected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."target_type" AS ENUM('user', 'organization');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installations_to_repos" (
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"installation_id" text NOT NULL,
	"github_repo_id" integer NOT NULL,
	"repo_id" text,
	"metadata" jsonb,
	"added_at" timestamp (6) with time zone NOT NULL,
	"removed_at" timestamp (6) with time zone,
	"repo_node_id" text NOT NULL,
	CONSTRAINT "installations_to_repos_installation_id_github_repo_id_pk" PRIMARY KEY("installation_id","github_repo_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "installations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"github_installation_id" bigint NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_id" text NOT NULL,
	"repository_selection" "repository_selection" NOT NULL,
	"installed_by_user_id" text NOT NULL,
	"installed_at" timestamp (6) with time zone NOT NULL,
	"uninstalled_at" timestamp (6) with time zone,
	"suspended_at" timestamp (6) with time zone,
	"suspended_by" text,
	"permissions" jsonb,
	"permissions_updated_at" timestamp (6) with time zone,
	CONSTRAINT "installations_github_installation_id_unique" UNIQUE("github_installation_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"node_id" text NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"html_url" text NOT NULL,
	CONSTRAINT "organizations_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installations_to_repos" ADD CONSTRAINT "installations_to_repos_installation_id_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."installations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installations_to_repos" ADD CONSTRAINT "installations_to_repos_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "installations" ADD CONSTRAINT "installations_installed_by_user_id_users_id_fk" FOREIGN KEY ("installed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installations_to_repos_installation_idx" ON "installations_to_repos" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installations_to_repos_repo_idx" ON "installations_to_repos" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installations_to_repos_repo_node_idx" ON "installations_to_repos" USING btree ("repo_node_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installations_to_repos_active_idx" ON "installations_to_repos" USING btree ("installation_id") WHERE "installations_to_repos"."removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installations_target_idx" ON "installations" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "installations_installed_by_user_idx" ON "installations" USING btree ("installed_by_user_id");