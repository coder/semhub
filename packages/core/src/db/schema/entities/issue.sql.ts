import { eq, relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  vector,
} from "drizzle-orm/pg-core";

import type { StateSubmenuValue } from "@/constants/search";

import { getBaseColumns, timestamptz } from "../base.sql";
import { type Author } from "../shared";
import { issuesToLabels } from "./issue-to-label.sql";
import { repos } from "./repo.sql";

export const issueStateEnum = pgEnum("issue_state", ["OPEN", "CLOSED"]);

export const convertToIssueStateSql = (state: StateSubmenuValue) => {
  switch (state) {
    case "open":
      return eq(issueTable.issueState, "OPEN");
    case "closed":
      return eq(issueTable.issueState, "CLOSED");
    case "all":
      return sql`true`;
  }
};

export const issueStateReasonEnum = pgEnum("issue_state_reason", [
  "COMPLETED",
  "REOPENED",
  "NOT_PLANNED",
  "DUPLICATE",
]);

export const embeddingSyncStatusEnum = pgEnum("embedding_sync_status", [
  "ready",
  "in_progress",
  "error",
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
    issueCreatedAt: timestamptz("issue_created_at").notNull(),
    issueUpdatedAt: timestamptz("issue_updated_at").notNull(),
    issueClosedAt: timestamptz("issue_closed_at"),
    embeddingModel: text("embedding_model"),
    // max dimension of 2000 if we use HNSW index; see https://github.com/pgvector/pgvector/issues/461
    // if we use text-embedding-3-large, which has 3072 dimensions, we need to reduce dimensions
    // see https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-dimensions
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingCreatedAt: timestamptz("embedding_created_at"),
    embeddingSyncStatus: embeddingSyncStatusEnum("embedding_sync_status")
      .notNull()
      .default("ready"),
  },
  (table) => ({
    repoIdIdx: index("repo_id_idx").on(table.repoId),
    embeddingIndex: index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    // ILIKE substring match: use GIN index
    // equality query: use regular b-tree index
    // see https://www.cybertec-postgresql.com/en/postgresql-more-performance-for-like-and-ilike-statements/
    titleSubstringIdx: index("title_substring_idx").using(
      "gin",
      sql`${table.title} gin_trgm_ops`,
    ),
    bodySubstringIdx: index("body_substring_idx").using(
      "gin",
      sql`${table.body} gin_trgm_ops`,
    ),
    // lower case match
    authorNameIdx: index("author_name_idx").on(
      sql`lower((${table.author}->>'name'::text))`,
    ),
    issueStateIdx: index("issue_state_idx").on(table.issueState),
    // for order desc check
    issueUpdatedAtIdx: index("issue_updated_at_idx").on(table.issueUpdatedAt),
    // to check if all embeddings for a repo have been created
    embeddingNullIdx: index("embedding_null_idx")
      .on(table.repoId)
      .where(sql`${table.embedding} IS NULL`),
  }),
);

export const issuesRelations = relations(issueTable, ({ many }) => ({
  issuesToLabels: many(issuesToLabels),
}));
