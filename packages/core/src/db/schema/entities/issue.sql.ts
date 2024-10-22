import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { getBaseColumns } from "../base.sql";
import { authorSchema, labelSchema, type Author, type Label } from "../shared";
import { repos } from "./repo.sql";

export const issueStateEnum = pgEnum("issue_state", ["OPEN", "CLOSED"]);
export const issueStateReasonEnum = pgEnum("issue_state_reason", [
  "COMPLETED",
  "REOPENED",
  "NOT_PLANNED",
  "DUPLICATE",
]);

export const issues = pgTable(
  "issues",
  {
    ...getBaseColumns("issues"),
    repoId: text("repo_id")
      .references(() => repos.id)
      .notNull(),
    nodeId: text("node_id").notNull().unique(),
    number: integer("number").notNull(), // unique issue number for a repo
    author: jsonb("author").$type<Author>(),
    issueState: issueStateEnum("issue_state").notNull(),
    issueStateReason: issueStateReasonEnum("issue_state_reason"),
    htmlUrl: text("html_url").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    labels: jsonb("labels").$type<Label[]>(),
    issueCreatedAt: timestamp("issue_created_at").notNull(),
    issueUpdatedAt: timestamp("issue_updated_at").notNull(),
    issueClosedAt: timestamp("issue_closed_at"),
  },
  (table) => ({
    repoIdIdx: index("repo_id_idx").on(table.repoId),
  }),
);

export const createIssueSchema = createInsertSchema(issues, {
  author: authorSchema,
  labels: z.array(labelSchema).optional(),
}).omit({
  id: true,
});

export type CreateIssue = z.infer<typeof createIssueSchema>;
