import { eq, sql } from "drizzle-orm";
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
import { type Author, type Label } from "../shared";
import { repos } from "./repo.sql";

export const issueStateEnum = pgEnum("issue_state", ["OPEN", "CLOSED"]);

export const convertToIssueStateSql = (state: StateSubmenuValue) => {
  switch (state) {
    case "open":
      return eq(issues.issueState, "OPEN");
    case "closed":
      return eq(issues.issueState, "CLOSED");
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
    issueCreatedAt: timestamptz("issue_created_at").notNull(),
    issueUpdatedAt: timestamptz("issue_updated_at").notNull(),
    issueClosedAt: timestamptz("issue_closed_at"),
    embeddingModel: text("embedding_model"),
    // max dimension of 2000 if we use HNSW index; see https://github.com/pgvector/pgvector/issues/461
    // if we use text-embedding-3-large, which has 3072 dimensions, we need to reduce dimensions
    // see https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-dimensions
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingCreatedAt: timestamptz("embedding_created_at"),
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
    authorNameIdx: index("author_name_idx").on(
      sql`lower((${table.author}->>'name'::text))`,
    ),
  }),
);
