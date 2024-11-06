import dedent from "dedent";
import type { SQL } from "drizzle-orm";

import { EMBEDDING_MODEL, type RateLimiter } from "./constants/rate-limit";
import {
  and,
  cosineDistance,
  getDrizzle,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "./db";
import type { IssueFieldsForEmbedding } from "./db/schema/entities/issue.schema";
import { issues } from "./db/schema/entities/issue.sql";
import { getOpenAIClient } from "./openai";
import { isReducePromptError } from "./openai/errors";
import { embeddingsCreateSchema } from "./openai/schema";
import { sleep } from "./util";

export namespace Embedding {
  // cannot use large model because of max dimension of 2000 in pgvector
  // see https://github.com/pgvector/pgvector/issues/461
  async function createEmbedding({
    input,
    rateLimiter,
  }: {
    input: string;
    rateLimiter?: RateLimiter;
  }) {
    const client = getOpenAIClient();
    if (rateLimiter) {
      while (true) {
        const millisecondsToNextRequest =
          await rateLimiter.getDurationToNextRequest(EMBEDDING_MODEL);
        if (millisecondsToNextRequest === 0) break;
        console.log(`Rate limit hit, waiting ${millisecondsToNextRequest}ms`);
        await sleep(millisecondsToNextRequest);
      }
    }
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });
    const result = embeddingsCreateSchema.parse(res);
    return result.data[0]!.embedding;
  }
  export async function findSimilarIssues({
    query,
    rateLimiter,
  }: {
    query: string;
    rateLimiter?: RateLimiter;
  }) {
    const db = getDrizzle();
    const embedding = await createEmbedding({ input: query, rateLimiter });
    const similarity = sql<number>`1-(${cosineDistance(issues.embedding, embedding)})`;
    const similarIssues = await db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
        body: issues.body,
        labels: issues.labels,
        url: issues.htmlUrl,
        author: issues.author,
        issueState: issues.issueState,
        issueStateReason: issues.issueStateReason,
        issueCreatedAt: issues.issueCreatedAt,
        issueClosedAt: issues.issueClosedAt,
        issueUpdatedAt: issues.issueUpdatedAt,
        similarity,
      })
      .from(issues)
      .where(gt(similarity, 0.3))
      .limit(50);
    console.log({ similarIssues });
    return similarIssues;
  }
  export async function syncIssues(rateLimiter?: RateLimiter) {
    const TRUNCATION_MAX_ATTEMPTS = 8;
    const BATCH_SIZE = 20;
    const db = getDrizzle();
    // First, get all IDs that need processing (no lock needed)
    const issueIds = await db
      .select({ id: issues.id })
      .from(issues)
      .where(
        or(
          isNull(issues.embedding),
          lt(issues.embeddingCreatedAt, issues.issueUpdatedAt),
        ),
      );

    console.log(`${issueIds.length} issues to process`);
    // TODO: in future, add these issues to a queue and process them in separate workers to prevent timeout

    // Process issues in batches
    for (let i = 0; i < issueIds.length; i += BATCH_SIZE) {
      const batchIds = issueIds.slice(i, i + BATCH_SIZE);
      if (batchIds.length === 0) continue;
      // Now lock only the batch we're processing
      await db.transaction(async (tx) => {
        const batchedIssues = await tx
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
            and(
              inArray(
                issues.id,
                batchIds.map((b) => b.id),
              ),
              // adding this in case there is race condition
              // not strictly necessary
              or(
                isNull(issues.embedding),
                lt(issues.embeddingCreatedAt, issues.issueUpdatedAt),
              ),
            ),
          )
          .for("update");

        if (batchedIssues.length === 0) {
          console.log(
            "No issues to process in this batch, likely race condition, skipping processing",
          );
          return;
        }
        const embeddings = await Promise.all(
          batchedIssues.map(async (issue) => {
            try {
              const embedding = await (async () => {
                let attempt = 1;
                while (attempt <= TRUNCATION_MAX_ATTEMPTS) {
                  try {
                    return await createEmbedding({
                      input: formatIssueForEmbedding({ ...issue, attempt }),
                      rateLimiter,
                    });
                  } catch (error) {
                    if (
                      isReducePromptError(error) &&
                      attempt < TRUNCATION_MAX_ATTEMPTS
                    ) {
                      console.log(
                        `Retrying issue #${issue.number} with truncation attempt ${attempt + 1}`,
                      );
                      attempt++;
                      continue;
                    }
                    throw error;
                  }
                }
                throw new Error(
                  `Failed to create embedding after ${TRUNCATION_MAX_ATTEMPTS} attempts`,
                );
              })();
              console.log(`created embedding for issue #${issue.number}`);
              return {
                issueId: issue.id,
                embedding,
              };
            } catch (error) {
              console.error(`Failed to process issue #${issue.number}:`, error);
              return null;
            }
          }),
        );

        // Bulk update the database with valid embeddings
        const validEmbeddings = embeddings.filter(
          (e): e is NonNullable<typeof e> => e !== null,
        );
        if (validEmbeddings.length === 0) {
          console.log(
            "No valid embeddings to process in this batch, skipping update",
          );
          return;
        }
        const sqlChunks: SQL[] = [];
        const issueIdArray: string[] = [];

        sqlChunks.push(sql`(case`);

        for (const e of validEmbeddings) {
          sqlChunks.push(
            sql`when ${issues.id} = ${e.issueId} then '[${sql.raw(e.embedding.join(","))}]'::vector`,
          );
          issueIdArray.push(e.issueId);
        }

        sqlChunks.push(sql`end)`);

        const embeddingSql = sql.join(sqlChunks, sql.raw(" "));

        await tx
          .update(issues)
          .set({
            embedding: embeddingSql,
            embeddingModel: EMBEDDING_MODEL,
            embeddingCreatedAt: new Date(),
          })
          .where(inArray(issues.id, issueIdArray));
        console.log(
          `Processed batch ${Math.ceil(i / BATCH_SIZE + 1)} of ${Math.ceil(issueIds.length / BATCH_SIZE)}`,
        );
        console.log(`${validEmbeddings.length} embeddings created`);
        console.log(
          `Invalid count: ${embeddings.length - validEmbeddings.length}`,
        );
      });
    }
  }
  /* Alternate way to format issue for embedding */
  /* Instead of truncating the body repeatedly, we could pass the body into a LLM and obtain a summary. Then, we pass the summary into the embedding API instead. */
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
    attempt = 1,
  }: IssueFieldsForEmbedding & { attempt: number }): string {
    // Truncate body to roughly 6000 tokens to leave room for other fields
    const truncatedBody = truncateText(body, attempt);

    return (
      dedent`
    Issue #${number}: ${title}
    Body: ${truncatedBody}
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
  function truncateText(text: string, attempt: number): string {
    // DISCUSSION:
    // - could use a tokenizer to more accurately measure token length, e.g. https://github.com/dqbd/tiktoken
    // - alternatively, the error returned by OpenAI also tells you how many token it is and hence how much it needs to be reduced
    const TRUNCATION_FACTOR = 0.75; // after 8x retry, will be 10% of original length
    const TRUNCATION_MAX_TOKENS = 6000; // somewhat arbitrary
    // Rough approximation: 1 token ≈ 4 characters
    // currently, it seem like issues that have huge blocks of code and logs are being tokenized very differently from this heuristic
    const maxChars = Math.floor(
      TRUNCATION_MAX_TOKENS * 4 * Math.pow(TRUNCATION_FACTOR, attempt - 1),
    );
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }
}
