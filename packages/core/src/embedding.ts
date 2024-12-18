import dedent from "dedent";
import pMap from "p-map";

import { sleep } from "@/util/sleep";
import { truncateCodeBlocks, truncateToByteSize } from "@/util/truncate";

import {
  EMBEDDING_MODEL,
  type RateLimiter,
} from "./constants/rate-limit.constant";
import type { DbClient } from "./db";
import { and, asc, eq, inArray, isNull, lt, not, or } from "./db";
import { issueEmbeddings } from "./db/schema/entities/issue-embedding.sql";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import type { SelectIssueForEmbedding } from "./db/schema/entities/issue.schema";
import { issueTable } from "./db/schema/entities/issue.sql";
import type { SelectLabelForEmbedding } from "./db/schema/entities/label.schema";
import { labels as labelTable } from "./db/schema/entities/label.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { conflictUpdateOnly } from "./db/utils/conflict";
import { jsonAggBuildObjectFromJoin } from "./db/utils/json";
import type { OpenAIClient } from "./openai";
import { isReducePromptError } from "./openai/errors";
import { embeddingsCreateSchema } from "./openai/schema";

export namespace Embedding {
  export async function createEmbedding(
    {
      input,
      rateLimiter,
    }: {
      input: string;
      rateLimiter: RateLimiter | null;
    },
    openAIClient: OpenAIClient,
  ) {
    if (rateLimiter) {
      while (true) {
        const millisecondsToNextRequest =
          await rateLimiter.getDurationToNextRequest(EMBEDDING_MODEL);
        if (millisecondsToNextRequest === 0) break;
        console.log(`Rate limit hit, waiting ${millisecondsToNextRequest}ms`);
        await sleep(millisecondsToNextRequest);
      }
    }
    const res = await openAIClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input,
    });
    const result = embeddingsCreateSchema.parse(res);
    return result.data[0]!.embedding;
  }
  export async function createEmbeddings({
    issues,
    rateLimiter,
    openai,
    concurrencyLimit,
  }: {
    issues: Awaited<ReturnType<typeof Embedding.selectIssuesForEmbeddingInit>>;
    rateLimiter: RateLimiter | null;
    openai: OpenAIClient;
    concurrencyLimit?: number;
  }) {
    const TRUNCATION_MAX_ATTEMPTS = 8;
    const processIssue = async (issue: (typeof issues)[number]) => {
      let attempt = 0;
      const labels = issue.labels;
      while (attempt <= TRUNCATION_MAX_ATTEMPTS) {
        try {
          const embedding = await createEmbedding(
            {
              input: formatIssueForEmbedding({
                issue,
                labels,
                attempt,
              }),
              rateLimiter,
            },
            openai,
          );
          return {
            issueId: issue.id,
            embedding,
          };
        } catch (error) {
          if (isReducePromptError(error) && attempt < TRUNCATION_MAX_ATTEMPTS) {
            console.log(
              `Retrying issue #${issue.number} with truncation attempt ${attempt + 1}`,
            );
            attempt++;
          } else {
            throw error;
          }
        }
      }
      throw new Error(
        `Failed to create embedding for issue #${issue.number} after ${TRUNCATION_MAX_ATTEMPTS} attempts`,
      );
    };
    return await pMap(issues, processIssue, { concurrency: concurrencyLimit });
  }
  export async function selectIssuesForEmbeddingInit(
    issueIds: string[],
    db: DbClient,
  ) {
    return await db
      .select({
        id: issueTable.id,
        number: issueTable.number,
        author: issueTable.author,
        title: issueTable.title,
        body: issueTable.body,
        issueState: issueTable.issueState,
        issueStateReason: issueTable.issueStateReason,
        issueCreatedAt: issueTable.issueCreatedAt,
        issueClosedAt: issueTable.issueClosedAt,
        labels: jsonAggBuildObjectFromJoin(
          {
            name: labelTable.name,
            description: labelTable.description,
          },
          {
            from: issuesToLabels,
            joinTable: labelTable,
            joinCondition: eq(labelTable.id, issuesToLabels.labelId),
            whereCondition: eq(issuesToLabels.issueId, issueTable.id),
          },
        ),
      })
      .from(issueTable)
      .leftJoin(issueEmbeddings, eq(issueEmbeddings.issueId, issueTable.id))
      .where(
        and(
          inArray(issueTable.id, issueIds),
          // this is not strictly necessary for mode "init", since issueIds preselected
          or(
            isNull(issueEmbeddings.embedding),
            lt(issueEmbeddings.embeddingGeneratedAt, issueTable.issueUpdatedAt),
          ),
        ),
      )
      .orderBy(asc(issueTable.issueUpdatedAt));
  }
  export async function selectIssuesForEmbeddingCron(
    db: DbClient,
    numIssues: number,
  ) {
    return await db.transaction(
      async (tx) => {
        const issues = await tx
          .select({
            id: issueTable.id,
            number: issueTable.number,
            author: issueTable.author,
            title: issueTable.title,
            body: issueTable.body,
            issueState: issueTable.issueState,
            issueStateReason: issueTable.issueStateReason,
            issueCreatedAt: issueTable.issueCreatedAt,
            issueClosedAt: issueTable.issueClosedAt,
            labels: jsonAggBuildObjectFromJoin(
              {
                name: labelTable.name,
                description: labelTable.description,
              },
              {
                from: issuesToLabels,
                joinTable: labelTable,
                joinCondition: eq(labelTable.id, issuesToLabels.labelId),
                whereCondition: eq(issuesToLabels.issueId, issueTable.id),
              },
            ),
          })
          .from(issueTable)
          .leftJoin(repos, eq(repos.id, issueTable.repoId))
          .leftJoin(issueEmbeddings, eq(issueEmbeddings.issueId, issueTable.id))
          .where(
            and(
              eq(issueEmbeddings.embeddingSyncStatus, "ready"),
              or(
                isNull(issueEmbeddings.embedding),
                lt(
                  issueEmbeddings.embeddingGeneratedAt,
                  issueTable.issueUpdatedAt,
                ),
              ),
              not(eq(repos.syncStatus, "in_progress")), // these repos could see their issues changing, don't create embedding
              eq(repos.initStatus, "completed"), // embedding taken care of by init workflow
            ),
          )
          .orderBy(asc(issueTable.issueUpdatedAt))
          .limit(numIssues)
          .for("update");

        if (issues.length === 0) return [];
        await tx
          .update(issueEmbeddings)
          .set({
            embeddingSyncStatus: "in_progress",
          })
          .where(
            inArray(
              issueEmbeddings.issueId,
              issues.map((i) => i.id),
            ),
          );
        return issues;
      },
      {
        isolationLevel: "serializable",
      },
    );
  }
  export async function upsertIssueEmbeddings(
    embeddings: Awaited<ReturnType<typeof Embedding.createEmbeddings>>,
    db: DbClient,
  ) {
    if (embeddings.length === 0) return;
    const issueEmbeddingsToInsert = embeddings.map((e) => ({
      issueId: e.issueId,
      embedding: e.embedding,
      embeddingModel: EMBEDDING_MODEL,
      embeddingGeneratedAt: new Date(),
      embeddingSyncStatus: "ready" as const,
    }));
    await db
      .insert(issueEmbeddings)
      .values(issueEmbeddingsToInsert)
      .onConflictDoUpdate({
        target: [issueEmbeddings.issueId],
        set: conflictUpdateOnly(issueEmbeddings, [
          "embedding",
          "embeddingModel",
          "embeddingGeneratedAt",
          "embeddingSyncStatus",
        ]),
      });
  }
  interface FormatIssueParams {
    attempt: number;
    issue: SelectIssueForEmbedding;
    labels: SelectLabelForEmbedding[];
  }

  /* Alternate way to format issue for embedding */
  /* Instead of truncating the body repeatedly, we could pass the body into a LLM and obtain a summary. Then, we pass the summary into the embedding API instead. */
  function formatIssueForEmbedding({
    issue,
    attempt = 0,
    labels,
  }: FormatIssueParams): string {
    const {
      number,
      author,
      title,
      body,
      issueState,
      issueStateReason,
      issueCreatedAt,
      issueClosedAt,
    } = issue;
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
    // currently, it seem like issues that have huge blocks of code and logs are being tokenized very differently from this heuristic
    // we first truncate per the body schema
    const MAX_BODY_SIZE_KB = 8;
    const CODE_BLOCK_PREVIEW_LINES = 10;
    text = truncateToByteSize(
      truncateCodeBlocks(text, CODE_BLOCK_PREVIEW_LINES),
      MAX_BODY_SIZE_KB * 1024,
    );
    // DISCUSSION:
    // - could use a tokenizer to more accurately measure token length, e.g. https://github.com/dqbd/tiktoken
    // - alternatively, the error returned by OpenAI also tells you how many token it is and hence how much it needs to be reduced
    const TRUNCATION_FACTOR = 0.75; // after 8x retry, will be 10% of original length
    const TRUNCATION_MAX_TOKENS = 6000; // somewhat arbitrary
    // Rough approximation: 1 token ≈ 4 characters
    const maxChars = Math.floor(
      TRUNCATION_MAX_TOKENS * 4 * Math.pow(TRUNCATION_FACTOR, attempt),
    );
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }
}
