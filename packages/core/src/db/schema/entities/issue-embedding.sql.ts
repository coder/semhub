import { index, pgEnum, pgTable, text, vector } from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";
import { issueTable } from "./issue.sql";

export const issueEmbeddingSyncStatusEnum = pgEnum(
  "issue_embedding_sync_status",
  ["ready", "in_progress", "error"],
);

export const issueEmbeddingTable = pgTable(
  "issue_embeddings",
  {
    ...getBaseColumns("issue_embeddings"),
    issueId: text("issue_id")
      .references(() => issueTable.id)
      .notNull(),
    embeddingModel: text("embedding_model"),
    // max dimension of 2000 if we use HNSW index; see https://github.com/pgvector/pgvector/issues/461
    // if we use text-embedding-3-large, which has 3072 dimensions, we need to reduce dimensions
    // see https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-dimensions
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingGeneratedAt: timestamptz("embedding_generated_at"),
    embeddingSyncStatus: issueEmbeddingSyncStatusEnum(
      "issue_embedding_sync_status",
    )
      .notNull()
      .default("ready"),
  },
  (table) => ({
    issueEmbeddingsIssueIdIdx: index("issue_embeddings_issue_id_idx").on(
      table.issueId,
    ),
    issueEmbeddingsEmbeddingIdx: index("issue_embeddings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);
