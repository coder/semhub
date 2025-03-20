import { eq, relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";
import type { AggregateReactions, TopCommenters } from "../shared";
import { type Author } from "../shared";
import { issuesToLabels } from "./issue-to-label.sql";
import { repos } from "./repo.sql";

export const issueStateEnum = pgEnum("issue_state", ["OPEN", "CLOSED"]);

export const issueStateReasonEnum = pgEnum("issue_state_reason", [
  "COMPLETED",
  "REOPENED",
  "NOT_PLANNED",
  "DUPLICATE",
]);

export const issueTable = pgTable(
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
    aggregateReactions: jsonb(
      "aggregate_reactions",
    ).$type<AggregateReactions>(),
    topCommenters: jsonb("top_commenters").$type<TopCommenters>(),
    issueCreatedAt: timestamptz("issue_created_at").notNull(),
    issueUpdatedAt: timestamptz("issue_updated_at").notNull(),
    issueClosedAt: timestamptz("issue_closed_at"),
  },
  (table) => [
    index("repo_id_idx").on(table.repoId),
    // ILIKE substring match: use GIN index
    // equality query: use regular b-tree index
    // see https://www.cybertec-postgresql.com/en/postgresql-more-performance-for-like-and-ilike-statements/
    index("title_substring_idx").using("gin", sql`${table.title} gin_trgm_ops`),
    index("body_substring_idx").using("gin", sql`${table.body} gin_trgm_ops`),
    // lower case match
    index("author_name_idx").on(sql`lower((${table.author}->>'name'::text))`),
    // partial index because (1) OPEN issue is minority of total issues; (2) more frequently querying OPEN issues
    index("issue_state_open_idx")
      .on(table.issueState)
      .where(sql`issue_state = 'OPEN'`),
    index("issue_updated_at_idx").on(table.issueUpdatedAt),
  ],
);

export const issuesRelations = relations(issueTable, ({ many }) => ({
  issuesToLabels: many(issuesToLabels),
}));

export const convertToIssueStateSql = (state: string) => {
  state = state.toLowerCase();
  switch (state) {
    case "open":
      return eq(issueTable.issueState, "OPEN");
    case "closed":
      return eq(issueTable.issueState, "CLOSED");
    case "all":
      return sql`true`;
    default:
      // actually has small chance of occurring
      // if inputs were not validated in schema.input
      throw new Error(`Invalid state: ${state}`);
  }
};

export type IssueTable = typeof issueTable;
