import dedent from "dedent";
import pMap from "p-map";

import type { DbClient } from "./db";
import { and, asc, eq, gt, inArray, isNull, lt, ne, or, sql } from "./db";
import { comments as commentTable } from "./db/schema/entities/comment.sql";
import { issueEmbeddings } from "./db/schema/entities/issue-embedding.sql";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import type { SelectIssueForEmbedding } from "./db/schema/entities/issue.schema";
import { issueTable } from "./db/schema/entities/issue.sql";
import type { SelectLabelForEmbedding } from "./db/schema/entities/label.schema";
import { labels as labelTable } from "./db/schema/entities/label.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { conflictUpdateOnly } from "./db/utils/conflict";
import { convertToSqlRaw } from "./db/utils/general";
import {
  jsonAggBuildObjectManyToMany,
  jsonAggBuildObjectOneToMany,
} from "./db/utils/json";
import { EMBEDDING_MODEL, type OpenAIClient } from "./openai";
import { isReducePromptError } from "./openai/errors";
import { embeddingsCreateSchema } from "./openai/schema";
import type { IssueSummary } from "./summary";

export async function createEmbedding(
  {
    input,
  }: {
    input: string;
  },
  openAIClient: OpenAIClient,
) {
  const res = await openAIClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: 256,
  });
  const result = embeddingsCreateSchema.parse(res);
  return result.data[0]!.embedding;
}

export async function createEmbeddings({
  issues,
  summaries,
  openai,
  concurrencyLimit,
}: {
  issues: SelectIssueForEmbedding[];
  summaries: IssueSummary[];
  openai: OpenAIClient;
  concurrencyLimit?: number;
}) {
  const processIssue = async (issue: (typeof issues)[number]) => {
    const { labels, number } = issue;
    const summary = summaries.find((s) => s.issueId === issue.id);
    if (!summary) {
      throw new Error(`No summary found for issue #${number}`);
    }
    try {
      const embedding = await createEmbedding(
        {
          input: formatIssueForEmbedding({
            issue,
            labels,
            summary,
          }),
        },
        openai,
      );
      return {
        issueId: issue.id,
        embedding,
      };
    } catch (error) {
      if (isReducePromptError(error)) {
        // TODO: do something?
        throw error;
      }
    }
    throw new Error(`Failed to create embedding for issue #${number}`);
  };
  return await pMap(issues, processIssue, { concurrency: concurrencyLimit });
}

export async function selectIssuesForEmbeddingInit(
  issueIds: string[],
  db: DbClient,
): Promise<SelectIssueForEmbedding[]> {
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
      aggregateReactions: issueTable.aggregateReactions,
      labels: jsonAggBuildObjectManyToMany(
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
      comments: jsonAggBuildObjectOneToMany(
        {
          body: commentTable.body,
          author: commentTable.author,
        },
        {
          from: commentTable,
          foreignKeyEquals: eq(commentTable.issueId, issueTable.id),
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

export async function selectIssuesForEmbeddingCron({
  db,
  numIssues,
  intervalInHours,
}: {
  db: DbClient;
  numIssues: number;
  intervalInHours: number;
}): Promise<SelectIssueForEmbedding[]> {
  return await db.transaction(async (tx) => {
    const lockedIssues = tx.$with("locked_issues").as(
      tx
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
          issueUpdatedAt: issueTable.issueUpdatedAt, // needed for the WHERE clause later
          aggregateReactions: issueTable.aggregateReactions,
        })
        .from(issueTable)
        .innerJoin(repos, eq(repos.id, issueTable.repoId))
        .where(
          and(
            ne(repos.syncStatus, "in_progress"),
            eq(repos.initStatus, "completed"),
            // this needs to be set with consideration to CRON_PATTERN
            gt(
              issueTable.issueUpdatedAt,
              sql`NOW() - INTERVAL '${convertToSqlRaw(intervalInHours)} hours'`,
            ),
          ),
        )
        .for("update", { skipLocked: true }),
    );

    const query = tx
      .with(lockedIssues)
      .select({
        id: lockedIssues.id,
        number: lockedIssues.number,
        author: lockedIssues.author,
        title: lockedIssues.title,
        body: lockedIssues.body,
        issueState: lockedIssues.issueState,
        issueStateReason: lockedIssues.issueStateReason,
        issueCreatedAt: lockedIssues.issueCreatedAt,
        issueClosedAt: lockedIssues.issueClosedAt,
        aggregateReactions: lockedIssues.aggregateReactions,
        labels: jsonAggBuildObjectManyToMany(
          {
            name: labelTable.name,
            description: labelTable.description,
          },
          {
            from: issuesToLabels,
            joinTable: labelTable,
            joinCondition: eq(labelTable.id, issuesToLabels.labelId),
            whereCondition: eq(issuesToLabels.issueId, lockedIssues.id),
          },
        ),
        comments: jsonAggBuildObjectOneToMany(
          {
            body: commentTable.body,
            author: commentTable.author,
          },
          {
            from: commentTable,
            foreignKeyEquals: eq(commentTable.issueId, lockedIssues.id),
          },
        ),
      })
      .from(lockedIssues)
      .leftJoin(issueEmbeddings, eq(issueEmbeddings.issueId, lockedIssues.id))
      .where(
        or(
          isNull(issueEmbeddings.embedding),
          and(
            eq(issueEmbeddings.embeddingSyncStatus, "ready"),
            lt(
              issueEmbeddings.embeddingGeneratedAt,
              lockedIssues.issueUpdatedAt,
            ),
          ),
        ),
      )
      .orderBy(asc(lockedIssues.issueUpdatedAt))
      .limit(numIssues);

    // const issues = await explainAnalyze(tx, query);
    const issues = await query;
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
  });
}

export async function upsertIssueEmbeddings(
  embeddings: Awaited<ReturnType<typeof createEmbeddings>>,
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

export async function unstuckIssueEmbeddings(db: DbClient) {
  await db.transaction(async (tx) => {
    const stuckIssueEmbeddings = await tx
      .select({
        id: issueEmbeddings.id,
      })
      .from(issueEmbeddings)
      .innerJoin(issueTable, eq(issueTable.id, issueEmbeddings.issueId))
      .where(
        and(
          eq(issueEmbeddings.embeddingSyncStatus, "in_progress"),
          lt(issueEmbeddings.embeddingGeneratedAt, issueTable.issueUpdatedAt),
          lt(issueTable.issueUpdatedAt, sql`NOW() - INTERVAL '12 hours'`),
        ),
      )
      .for("update", { skipLocked: true });

    if (stuckIssueEmbeddings.length === 0) return;
    await tx
      .update(issueEmbeddings)
      .set({ embeddingSyncStatus: "ready" })
      .where(
        inArray(
          issueEmbeddings.id,
          stuckIssueEmbeddings.map((i) => i.id),
        ),
      );
  });
}

interface FormatIssueParams {
  issue: SelectIssueForEmbedding;
  labels: SelectLabelForEmbedding[];
  summary: IssueSummary;
}

/* Alternate way to format issue for embedding */
/* Instead of truncating the body repeatedly, we could pass the body into a LLM and obtain a summary. Then, we pass the summary into the embedding API instead. */
function formatIssueForEmbedding({
  issue,
  labels,
  summary,
}: FormatIssueParams): string {
  const {
    number,
    author,
    title,
    issueState,
    issueStateReason,
    issueCreatedAt,
    issueClosedAt,
  } = issue;
  const { commentsSummary, bodySummary } = summary;

  return (
    dedent`
    Issue #${number}: ${title}
    Body: ${bodySummary}
    ${labels ? `Labels: ${labels.map((label) => `${label.name}${label.description ? ` (${label.description})` : ""}`).join(", ")}` : ""}
    ` +
    // the following are "metadata" fields, but including them because conceivably
    // users may include them in their search
    dedent`
    ${commentsSummary ? `Comments: ${commentsSummary}` : ""}
    State: ${issueState}
    State Reason: ${issueStateReason}
    ${author ? `Author: ${author.name}` : ""}
    Created At: ${issueCreatedAt}
    ${issueClosedAt ? `Closed At: ${issueClosedAt}` : ""}
    `
  );
}

// function truncateText(text: string, attempt: number): string {
//   // currently, it seem like issues that have huge blocks of code and logs are being tokenized very differently from this heuristic
//   // we first truncate per the body schema
//   const MAX_BODY_SIZE_KB = 8;
//   const CODE_BLOCK_PREVIEW_LINES = 10;
//   text = truncateToByteSize(
//     truncateCodeBlocks(text, CODE_BLOCK_PREVIEW_LINES),
//     MAX_BODY_SIZE_KB * 1024,
//   );
//   // DISCUSSION:
//   // - could use a tokenizer to more accurately measure token length, e.g. https://github.com/dqbd/tiktoken
//   // - alternatively, the error returned by OpenAI also tells you how many token it is and hence how much it needs to be reduced
//   const TRUNCATION_FACTOR = 0.75; // after 8x retry, will be 10% of original length
//   const TRUNCATION_MAX_TOKENS = 6000; // somewhat arbitrary
//   // Rough approximation: 1 token ≈ 4 characters
//   const maxChars = Math.floor(
//     TRUNCATION_MAX_TOKENS * 4 * Math.pow(TRUNCATION_FACTOR, attempt),
//   );
//   if (text.length <= maxChars) return text;
//   return text.slice(0, maxChars);
// }
