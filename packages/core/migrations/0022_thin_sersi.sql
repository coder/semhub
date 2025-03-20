DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('active', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users_to_repos" (
	"user_id" text NOT NULL,
	"repo_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"subscribed_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_to_repos_user_id_repo_id_pk" PRIMARY KEY("user_id","repo_id"),
	CONSTRAINT "users_to_repos_repo_id_user_id_unique" UNIQUE("repo_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "repos" RENAME COLUMN "owner" TO "owner_login";--> statement-breakpoint
DROP INDEX IF EXISTS "owner_name_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "owner_idx";--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "owner_avatar_url" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_to_repos" ADD CONSTRAINT "users_to_repos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_to_repos" ADD CONSTRAINT "users_to_repos_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "owner_name_idx" ON "repos" USING btree ("owner_login","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "owner_idx" ON "repos" USING btree ("owner_login");
