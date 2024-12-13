import { index, pgTable, text, vector } from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";
import { embeddingSyncStatusEnum, issueTable } from "./issue.sql";

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
    embeddingCreatedAt: timestamptz("embedding_created_at"),
    embeddingSyncStatus: embeddingSyncStatusEnum("embedding_sync_status")
      .notNull()
      .default("ready"),
  },
  (table) => ({
    issueIdIdx: index("issue_id_idx").on(table.issueId),
    embeddingIndex: index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  }),
);
