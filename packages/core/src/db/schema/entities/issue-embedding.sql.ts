import {
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

import { sql } from "@/db";

import { getBaseColumns, timestamptz } from "../base.sql";
import { issueTable } from "./issue.sql";

export const issueEmbeddingSyncStatusEnum = pgEnum(
  "issue_embedding_sync_status",
  ["ready", "in_progress", "error"],
);

export const issueEmbeddings = pgTable(
  "issue_embeddings",
  {
    ...getBaseColumns("issue_embeddings"),
    issueId: text("issue_id")
      .references(() => issueTable.id)
      .notNull(),
    embeddingModel: text("embedding_model"),
    // max dimension of 2000 if we use HNSW index; see https://github.com/pgvector/pgvector/issues/461
    // if we use text-embedding-3-large, which has 3072 dimensions, we need to reduce dimensions
    // see: https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-dimensions
    // use PLAIN storage for maximised performance; see: packages/core/migrations/0033_vector-plain-storage.sql
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingGeneratedAt: timestamptz("embedding_generated_at"),
    embeddingSyncStatus: issueEmbeddingSyncStatusEnum(
      "issue_embedding_sync_status",
    )
      .notNull()
      .default("ready"),
  },
  (table) => ({
    issueEmbeddingsIssueIdIdx: uniqueIndex("issue_embeddings_issue_id_idx").on(
      table.issueId,
    ),
    issueEmbeddingSyncStatusIdx: index("issue_embeddings_sync_status_idx").on(
      table.embeddingSyncStatus,
    ),
    // other parameters to tune:
    // ef_construction: default is 64, higher has better recall but comes at the expense of lower QPS
    // see: https://youtu.be/L8fQqVwTT3Y?si=VO_E8RsWECFxXjAg&t=1860
    // m: default is 16. higher has better recall, but increases build time and query time
    // if you can bulk insert and have multiple cores, build time is significantly lowered
    issueEmbeddingsEmbeddingIdx: index("issue_embeddings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    issueEmbeddingStatusGeneratedAtIdx: index(
      "issue_embeddings_status_generated_at_idx",
    ).on(table.embeddingSyncStatus, table.embeddingGeneratedAt),
    issueEmbeddingsNullIdx: index("issue_embeddings_null_idx")
      .on(table.issueId)
      .where(sql`embedding IS NULL`),
  }),
);
