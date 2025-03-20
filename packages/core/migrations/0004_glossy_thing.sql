CREATE TABLE IF NOT EXISTS "issues_to_labels" (
	"issue_id" text NOT NULL,
	"label_id" text NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issues_to_labels_issue_id_label_id_pk" PRIMARY KEY("issue_id","label_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "labels" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"node_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"description" text,
	CONSTRAINT "labels_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues_to_labels" ADD CONSTRAINT "issues_to_labels_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues_to_labels" ADD CONSTRAINT "issues_to_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "label_name_idx" ON "labels" USING btree ("name");