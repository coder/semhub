import { isNotNull } from "drizzle-orm";
import { ulid } from "ulidx";

import { issueEmbeddingTable as issueEmbeddings } from "@/core/db/schema/entities/issue-embedding.sql";
import { issueTable as issues } from "@/core/db/schema/entities/issue.sql";
import { getDeps } from "@/deps";

async function main() {
  console.log("Starting embedding migration...");

  const { db, closeConnection } = getDeps();

  // Get all issues with embeddings
  const issuesWithEmbeddings = await db
    .select({
      id: issues.id,
      embeddingModel: issues.embeddingModel,
      embedding: issues.embedding,
      embeddingGeneratedAt: issues.embeddingCreatedAt,
    })
    .from(issues)
    .where(isNotNull(issues.embedding));

  console.log(`Found ${issuesWithEmbeddings.length} issues with embeddings`);

  if (issuesWithEmbeddings.length === 0) {
    console.log("No embeddings to migrate, exiting");
    await closeConnection();
    return;
  }

  // Wrap database operations in a transaction
  await db.transaction(async (tx) => {
    console.log("Inserting embeddings...");

    const embeddingsToInsert = issuesWithEmbeddings.map((issue) => ({
      id: `iss_emb_${ulid()}`,
      issueId: issue.id,
      embeddingModel: issue.embeddingModel,
      embedding: issue.embedding,
      embeddingGeneratedAt: issue.embeddingGeneratedAt,
      embeddingSyncStatus: "ready" as const,
    }));

    const insertedEmbeddings = await tx
      .insert(issueEmbeddings)
      .values(embeddingsToInsert)
      .returning({
        id: issueEmbeddings.id,
      });

    console.log(`Inserted ${insertedEmbeddings.length} embeddings`);
  });

  await closeConnection();
  console.log("Migration completed successfully!");
}

main().catch(console.error);
