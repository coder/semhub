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
  nodeId: string;
}

interface Label {
  nodeId: string;
  name: string;
  color: string; // hex
  description?: string | null;
}

export const issueTypeEnum = pgEnum("issue_type", ["issue", "pr"]);
export const issueStateEnum = pgEnum("issue_state", [
  "open",
  "closed",
  "deleted",
]);
export const issueStateReasonEnum = pgEnum("issue_state_reason", [
  "null",
  "completed",
  "reopened",
  "not_planned",
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
    issueType: issueTypeEnum("issue_type").notNull(),
    issueState: issueStateEnum("issue_state").notNull(),
    issueStateReason:
      issueStateReasonEnum("issue_state_reason").default("null"),
    htmlUrl: text("html_url").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    labels: jsonb("labels").$type<Label[]>(),
    isDraft: boolean("is_draft"),
    issueCreatedAt: timestamp("issue_created_at").notNull(),
    issueUpdatedAt: timestamp("issue_updated_at").notNull(),
    issueClosedAt: timestamp("issue_closed_at"),
    // whatever we track, we will need to update via webhook in the future
    // ignore for now:
    // - assignees
    // - milestones
    // - locked and active_lock_reason
    // - closed_by
    // - reactions
  },
  (table) => ({
    repoIdIdx: index("repo_id_idx").on(table.repoId),
  }),
);

// Define Zod schemas for Author and Label
const authorSchema: z.ZodType<Author> = z.object({
  name: z.string(),
  htmlUrl: z.string().url(),
  nodeId: z.string(),
});

const labelSchema: z.ZodType<Label> = z.object({
  nodeId: z.string(),
  name: z.string(),
  color: z.string(), // You might want to add a regex for hex color validation
  description: z.string().nullable().optional(),
});

export const createIssueSchema = createInsertSchema(issues, {
  issueCreatedAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)),
  issueUpdatedAt: z
    .string()
    .datetime()
    .transform((date) => new Date(date)),
  issueClosedAt: z
    .string()
    .datetime()
    .nullable()
    .transform((date) => (date ? new Date(date) : null)),
  author: z
    .object({
      login: z.string(),
      html_url: z.string().url(),
      node_id: z.string(),
    })
    .strip()
    .transform(({ login, html_url, node_id }) => ({
      name: login,
      htmlUrl: html_url,
      nodeId: node_id,
    }))
    .pipe(authorSchema),
  labels: z
    .array(
      z
        .object({
          node_id: z.string(),
          name: z.string(),
          color: z.string(),
          description: z.string().nullable().optional(),
        })
        .strip()
        .transform(({ node_id, ...rest }) => ({ nodeId: node_id, ...rest }))
        .pipe(labelSchema),
    )
    .optional(),
}).omit({
  id: true,
  repoId: true,
  createdAt: true,
  updatedAt: true,
});
