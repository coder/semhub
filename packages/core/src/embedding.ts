import dedent from "dedent";
import type { SQL } from "drizzle-orm";
import { inArray, sql } from "drizzle-orm";

import { getDrizzle, isNull, lt, or } from "./db";
import type { IssueFieldsForEmbedding } from "./db/schema/entities/issue.schema";
import { issues } from "./db/schema/entities/issue.sql";
import { getOpenAIClient } from "./openai";
import { embeddingsCreateSchema } from "./openai/schema";
import type { RateLimiterName } from "./rate-limiter";
import { sleep } from "./util";

export module Embedding {
  export async function sync(rateLimiter?: {
    getDurationToNextRequest: (key: RateLimiterName) => Promise<number>;
  }) {
    const client = getOpenAIClient();
    const db = getDrizzle();
    // cannot use large model because of max dimension of 2000 in pgvector
    // see https://github.com/pgvector/pgvector/issues/461
    const model = "text-embedding-3-small";
    const BATCH_SIZE = 100;

    // get issues where (1) embedding is null (2) embedding was created BEFORE issueUpdatedAt
    const issuesWithOutdatedEmbedding: Array<IssueFieldsForEmbedding> = await db
      .select({
        id: issues.id,
        number: issues.number,
        author: issues.author,
        title: issues.title,
        body: issues.body,
        issueState: issues.issueState,
        issueStateReason: issues.issueStateReason,
        labels: issues.labels,
        issueCreatedAt: issues.issueCreatedAt,
        issueClosedAt: issues.issueClosedAt,
      })
      .from(issues)
      .where(
        or(
          isNull(issues.embedding), // (1)
          lt(issues.embeddingCreatedAt, issues.issueUpdatedAt), // (2)
        ),
      );
    console.log(`${issuesWithOutdatedEmbedding.length} issues to process`);

    // Process issues in batches
    for (let i = 0; i < issuesWithOutdatedEmbedding.length; i += BATCH_SIZE) {
      const batchedIssues = issuesWithOutdatedEmbedding.slice(
        i,
        i + BATCH_SIZE,
      );
      const embeddings: Array<{ issueId: string; embedding: number[] } | null> =
        [];
      for (const issue of batchedIssues) {
        // Rate limiting logic
        if (rateLimiter) {
          while (true) {
            const millisecondsToNextRequest =
              await rateLimiter.getDurationToNextRequest(
                "openai_text_embedding",
              );
            if (millisecondsToNextRequest === 0) break;
            console.log(
              `Rate limit hit, waiting ${millisecondsToNextRequest}ms before processing issue #${issue.number}`,
            );
            await sleep(millisecondsToNextRequest);
          }
        }

        const res = await client.embeddings.create({
          model,
          input: formatIssueForEmbedding(issue),
        });
        console.log(`created embedding for issue #${issue.number}`);
        const result = embeddingsCreateSchema.safeParse(res);
        if (!result.success) {
          console.error("error creating embedding", result.error);
          console.log(JSON.stringify(res, null, 2));
          embeddings.push(null);
          continue;
        }
        embeddings.push({
          issueId: issue.id,
          embedding: result.data.data[0]!.embedding,
        });
      }

      // Bulk update the database with valid embeddings
      const validEmbeddings = embeddings.filter(
        (e): e is NonNullable<typeof e> => e !== null,
      );
      if (validEmbeddings.length > 0) {
        const sqlChunks: SQL[] = [];
        const issueIds: string[] = [];

        sqlChunks.push(sql`(case`);

        for (const e of validEmbeddings) {
          sqlChunks.push(
            sql`when ${issues.id} = ${e.issueId} then '[${sql.raw(e.embedding.join(","))}]'::vector`,
          );
          issueIds.push(e.issueId);
        }

        sqlChunks.push(sql`end)`);

        const embeddingSql = sql.join(sqlChunks, sql.raw(" "));

        await db
          .update(issues)
          .set({
            embedding: embeddingSql,
            embeddingModel: model,
            embeddingCreatedAt: new Date(),
          })
          .where(inArray(issues.id, issueIds));
      }
      console.log(
        `Processed batch ${i / BATCH_SIZE + 1} of ${issuesWithOutdatedEmbedding.length / BATCH_SIZE}`,
      );
      console.log(`${validEmbeddings.length} embeddings created`);
      console.log(
        `Invalid count: ${embeddings.length - validEmbeddings.length}`,
      );
    }
  }
  function formatIssueForEmbedding({
    number,
    author,
    title,
    body,
    issueState,
    issueStateReason,
    labels,
    issueCreatedAt,
    issueClosedAt,
  }: IssueFieldsForEmbedding): string {
    return (
      dedent`
    Issue #${number}: ${title}
    Body: ${body}
    ${labels ? `Labels: ${labels.map((label) => `${label.name}${label.description ? ` (${label.description})` : ""}`).join(", ")}` : ""}
    ` +
      // the following are "metadata" fields, but including them because conceivably
      // users may include them in their search
      dedent`
    State: ${issueState}
    State Reason: ${issueStateReason}
    ${author ? `Author: ${author.name}` : ""}
    Created At: ${issueCreatedAt}
    ${issueClosedAt ? `Closed At: ${issueClosedAt}` : ""}
    `
    );
  }
}
