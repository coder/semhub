import type { AnyColumn, SQL } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns } from "../base.sql";
import { issuesToLabels } from "./issue-to-label.sql";

export const labels = pgTable("labels", {
  ...getBaseColumns("labels"),
  nodeId: text("node_id").notNull().unique(),
  // for a given repo, label name is case-insensitive-unique
  // BUT their display name is case-sensitive, that's why we don't normalise it
  name: text("name").notNull(),
  color: text("color").notNull(), // hex, could add validation in future
  description: text("description"),
});

export const labelsRelations = relations(labels, ({ many }) => ({
  issuesToLabels: many(issuesToLabels),
}));

/**
 * Creates a condition to check if all specified labels are present for an issue
 * @param issueId The ID of the issue to check
 * @param labelQueries Array of label names to check for (case-insensitive)
 */
export function hasAllLabels(
  issueId: SQL | AnyColumn,
  labelQueries: string[],
): SQL<boolean> {
  if (labelQueries.length === 0) {
    return sql`true`;
  }

  const valuesArray = sql.join(
    labelQueries.map((v) => sql`${v.toLowerCase()}`),
    sql`, `,
  );

  // to check all labels are present, we sort both arrays and compare
  // comparison is via lowercase because label is case-insensitive-unique
  return sql`(
    SELECT ARRAY_AGG(DISTINCT LOWER(l.name) ORDER BY LOWER(l.name)) =
           ARRAY(SELECT unnest(ARRAY[${valuesArray}]) ORDER BY 1)
    FROM "issues_to_labels" itl
    JOIN "labels" l ON l.id = itl.label_id
    WHERE itl.issue_id = ${issueId}
    AND LOWER(l.name) = ANY(ARRAY[${valuesArray}])
  )`;
}
