ALTER TABLE "issues_to_labels" DROP CONSTRAINT "issues_to_labels_issue_id_issues_id_fk";
--> statement-breakpoint
ALTER TABLE "issues_to_labels" DROP CONSTRAINT "issues_to_labels_label_id_labels_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues_to_labels" ADD CONSTRAINT "issues_to_labels_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues_to_labels" ADD CONSTRAINT "issues_to_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "issues_to_labels" ADD CONSTRAINT "issues_to_labels_label_id_issue_id_unique" UNIQUE("label_id","issue_id");