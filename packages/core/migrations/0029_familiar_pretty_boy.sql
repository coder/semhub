CREATE TABLE IF NOT EXISTS "public_collections_to_repos" (
	"collection_id" text NOT NULL,
	"repo_id" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_collections_to_repos_collection_id_repo_id_pk" PRIMARY KEY("collection_id","repo_id"),
	CONSTRAINT "public_collections_to_repos_repo_id_collection_id_unique" UNIQUE("repo_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "public_collections_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public_collections_to_repos" ADD CONSTRAINT "public_collections_to_repos_collection_id_public_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."public_collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public_collections_to_repos" ADD CONSTRAINT "public_collections_to_repos_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
