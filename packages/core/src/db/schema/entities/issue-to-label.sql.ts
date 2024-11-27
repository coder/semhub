import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";

import { getTimestampColumns } from "../base.sql";
import { issues } from "./issue.sql";
import { labels } from "./label.sql";

export const issuesToLabels = pgTable(
  "issues_to_labels",
  {
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, {
        onDelete: "cascade",
      }),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, {
        onDelete: "cascade",
      }),
    ...getTimestampColumns(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.issueId, t.labelId] }),
    // big brain reverse unique index, see https://stackoverflow.com/a/60248297
    reversePk: unique().on(t.labelId, t.issueId),
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
