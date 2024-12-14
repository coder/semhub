import { count, isNotNull } from "drizzle-orm";
import { ulid } from "ulidx";

import { issueEmbeddingTable as issueEmbeddings } from "@/core/db/schema/entities/issue-embedding.sql";
import { issueTable as issues } from "@/core/db/schema/entities/issue.sql";
import { getDeps } from "@/deps";

async function main() {
  console.log("Starting embedding migration...");

  const { db, closeConnection } = getDeps();
  const CHUNK_SIZE = 100; // Adjust based on your needs

  // Get total count first
  const [totalCount] = await db
    .select({ count: count() })
    .from(issues)
    .where(isNotNull(issues.embedding));

  if (!totalCount) {
    throw new Error("Something went wrong while fetching count");
  }
  const { count: embeddingCount } = totalCount;
  console.log(`Found ${embeddingCount} issues with embeddings`);

  if (embeddingCount === 0) {
    console.log("No embeddings to migrate, exiting");
    await closeConnection();
    return;
  }

  let processedCount = 0;
  let offset = 0;

  while (processedCount < embeddingCount) {
    console.log(`Processing chunk starting at offset ${offset}...`);

    const issuesChunk = await db
      .select({
        id: issues.id,
        embeddingModel: issues.embeddingModel,
        embedding: issues.embedding,
        embeddingGeneratedAt: issues.embeddingCreatedAt,
      })
      .from(issues)
      .where(isNotNull(issues.embedding))
      .limit(CHUNK_SIZE)
      .offset(offset);

    if (issuesChunk.length === 0) break;

    await db.transaction(async (tx) => {
      console.log("Inserting embeddings...");

      const embeddingsToInsert = issuesChunk.map((issue) => ({
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
        .returning({ id: issueEmbeddings.id });

      console.log(`Inserted ${insertedEmbeddings.length} embeddings`);
    });

    processedCount += issuesChunk.length;
    offset += CHUNK_SIZE;
    console.log(
      `Progress: ${processedCount}/${embeddingCount} (${Math.round((processedCount / embeddingCount) * 100)}%)`,
    );
  }

  await closeConnection();
  console.log("Migration completed successfully!");
}

main().catch(console.error);
