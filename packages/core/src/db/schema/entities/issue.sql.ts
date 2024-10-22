import {
  boolean,
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
import { repos } from "./repo.sql";

// save as JSONB now, can normalise in the future if needed
interface Author {
  name: string;
  htmlUrl: string;
}

interface Label {
  nodeId: string;
  name: string;
  color: string; // hex
  description?: string | null;
}

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
    body: text("body"),
    labels: jsonb("labels").$type<Label[]>(),
    issueCreatedAt: timestamp("issue_created_at").notNull(),
    issueUpdatedAt: timestamp("issue_updated_at").notNull(),
    issueClosedAt: timestamp("issue_closed_at"),
  },
  (table) => ({
    repoIdIdx: index("repo_id_idx").on(table.repoId),
  }),
);

// Define Zod schemas for Author and Label
const authorSchema: z.ZodType<Author> = z.object({
  name: z.string(),
  htmlUrl: z.string().url(),
});

const labelSchema: z.ZodType<Label> = z.object({
  nodeId: z.string(),
  name: z.string(),
  color: z.string(), // You might want to add a regex for hex color validation
  description: z.string().nullable().optional(),
});

export const createIssueSchema = createInsertSchema(issues, {
  issueCreatedAt: z.date(),
  issueUpdatedAt: z.date(),
  issueClosedAt: z.date().nullable(),
  author: authorSchema,
  labels: z.array(labelSchema).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateIssue = z.infer<typeof createIssueSchema>;
