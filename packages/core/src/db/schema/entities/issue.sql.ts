import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  vector,
} from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";
import { type Author, type Label } from "../shared";
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
    issueCreatedAt: timestamptz("issue_created_at").notNull(),
    issueUpdatedAt: timestamptz("issue_updated_at").notNull(),
    issueClosedAt: timestamptz("issue_closed_at"),
    embeddingModel: text("embedding_model"),
    embedding: vector("embedding", { dimensions: 1536 }), // default number of dimensions
    embeddingCreatedAt: timestamptz("embedding_created_at"),
  },
  (table) => ({
    repoIdIdx: index("repo_id_idx").on(table.repoId),
    embeddingIndex: index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);
