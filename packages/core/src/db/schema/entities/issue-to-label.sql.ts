import { relations } from "drizzle-orm";
import { pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";

import { getTimestampColumns } from "../base.sql";
import { issueTable } from "./issue.sql";
import { labels } from "./label.sql";

export const issuesToLabels = pgTable(
  "issues_to_labels",
  {
    issueId: text("issue_id")
      .notNull()
      .references(() => issueTable.id, {
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
  issue: one(issueTable, {
    fields: [issuesToLabels.issueId],
    references: [issueTable.id],
  }),
  label: one(labels, {
    fields: [issuesToLabels.labelId],
    references: [labels.id],
  }),
}));
