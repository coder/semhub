import { relations } from "drizzle-orm";
import { pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { getTimestampColumns } from "../base.sql";
import { issues } from "./issue.sql";
import { labels } from "./label.sql";

export const issuesToLabels = pgTable(
  "issues_to_labels",
  {
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id),
    ...getTimestampColumns(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.issueId, t.labelId] }),
  }),
);

export const issuesToLabelsRelations = relations(issuesToLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issuesToLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issuesToLabels.labelId],
    references: [labels.id],
  }),
}));
