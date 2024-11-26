import { relations, sql } from "drizzle-orm";
import { index, pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns } from "../base.sql";
import { issuesToLabels } from "./issue-to-label.sql";

export const labels = pgTable("labels", {
  ...getBaseColumns("labels"),
  nodeId: text("node_id").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull(), // hex, could add validation in future
  description: text("description"),
});

export const labelsRelations = relations(labels, ({ many }) => ({
  issuesToLabels: many(issuesToLabels),
}));
