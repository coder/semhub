CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"node_id" text NOT NULL,
	"login" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"html_url" text NOT NULL,
	"github_scopes" jsonb,
	"auth_revoked_at" timestamp (6) with time zone,
	"access_token" text NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "users_node_id_unique" UNIQUE("node_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
