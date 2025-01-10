import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { DbClient } from "./db";
import { and, count as countFn, desc, eq, sql } from "./db";
import { issueEmbeddings } from "./db/schema/entities/issue-embedding.sql";
import { issueTable } from "./db/schema/entities/issue.sql";
import { selectLabelForSearchSchema } from "./db/schema/entities/label.schema";
import type { SelectRepoForSearch } from "./db/schema/entities/repo.schema";
import { repos } from "./db/schema/entities/repo.sql";
import { authorSchema } from "./db/schema/shared";
import { cosineDistance } from "./db/utils/vector";
import { createEmbedding } from "./embedding";
import type { OpenAIClient } from "./openai";
import { applyFilters, applyPagination, getBaseSelect } from "./semsearch.db";
import {
  calculateCommentScore,
  calculateRankingScore,
  calculateRecencyScore,
  calculateSimilarityScore,
} from "./semsearch.ranking";
import type { SearchParams } from "./semsearch.types";
import { parseSearchQuery } from "./semsearch.util";

const selectRepoForSearchSchemaDuplicated = z.object({
  // can't figure out how to use selectRepoForSearchSchema from repo.schema.ts here
  // after you transform, you lose the .shape property
  // so repeating the fields here
  repoName: z.string(),
  repoOwnerName: z.string(),
  repoUrl: z.string().url(),
  repoLastSyncedAt: z.date().nullable(),
}) satisfies z.ZodType<SelectRepoForSearch>;

// Create a schema that matches exactly what we return in search results
const searchIssueSchema = createSelectSchema(issueTable, {
  author: authorSchema,
})
  .pick({
    id: true,
    number: true,
    title: true,
    author: true,
    issueState: true,
    issueStateReason: true,
    issueCreatedAt: true,
    issueClosedAt: true,
    issueUpdatedAt: true,
  })
  .extend({
    labels: z.array(selectLabelForSearchSchema),
    issueUrl: z.string().url(),
    ...selectRepoForSearchSchemaDuplicated.shape,
    // Search-specific fields
    commentCount: z.number(),
    similarityScore: z.number(),
    rankingScore: z.number(),
  })
  .transform((issue) => ({
    ...issue,
  }));

export const searchResultSchema = z.object({
  data: z.array(searchIssueSchema),
  totalCount: z.number(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export async function searchIssues(
  params: SearchParams,
  db: DbClient,
  openai: OpenAIClient,
): Promise<SearchResult> {
  const ISSUE_COUNT_THRESHOLD = 5000;
  const parsedSearchQuery = parseSearchQuery(params.query);

  // Get matching issues count and embedding in parallel
  const [matchingCount, embedding] = await Promise.all([
    getFilteredIssuesCount(params, parsedSearchQuery, db),
    createEmbedding(
      {
        // embed query without operators, not sure if this gets better results
        // if remainingQuery is empty, pass the whole original query
        input: parsedSearchQuery.remainingQuery ?? params.query,
      },
      openai,
    ),
  ]);
  const useHnswIndex = matchingCount > ISSUE_COUNT_THRESHOLD;
  // we are currently routing search based on ISSUE_COUNT_THRESHOLD
  // (1) if higher, we HNSW index and apply the filter afterwards
  // (2) if lower, we filter before the vector search and do a full seq scan
  // downside of (1) if searching across not that many issues: end up with very few results
  // downside of (2) if searching across too many issues:queries are too slow
  const result = useHnswIndex
    ? await filterAfterVectorSearch(params, parsedSearchQuery, db, embedding)
    : await filterBeforeVectorSearch(params, parsedSearchQuery, db, embedding);
  // other possible solutions that I did not have time to fully explore:
  // (1) look into using hnsw.iterative_scan (previous attempt did not work well)
  // (2) try IVFFlat index instead of HNSW (see https://github.com/pgvector/pgvector/issues/560)
  // (2) see also: https://github.com/pgvector/pgvector?tab=readme-ov-file (sections on filtering, troubleshooting)
  // https://tembo.io/blog/vector-indexes-in-pgvector
  return result;
}

async function getFilteredIssuesCount(
  searchParams: SearchParams,
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
  db: DbClient,
) {
  return db.transaction(async (tx) => {
    let query = tx
      .select({
        count: countFn(),
      })
      .from(issueTable)
      .innerJoin(
        repos,
        and(eq(issueTable.repoId, repos.id), eq(repos.initStatus, "completed")),
      )
      .$dynamic();

    query = applyFilters(query, searchParams, parsedSearchQuery);

    // const [result] = await explainAnalyze(tx, query);
    const [result] = await query;

    return result?.count ?? 0;
  });
}

async function filterAfterVectorSearch(
  params: SearchParams,
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
  db: DbClient,
  embedding: number[],
) {
  const SIMILARITY_LIMIT = 100;
  const offset = (params.page - 1) * params.pageSize;

  return await db.transaction(async (tx) => {
    // adjust this to trade-off between speed and number of eventual matches
    await tx.execute(sql`SET LOCAL hnsw.ef_search = 400;`);
    // this is default value
    await tx.execute(sql`SET LOCAL hnsw.max_scan_tuples = 20000;`);
    // this is fine since we are using custom ranking
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = 'relaxed_order';`);

    // Stage 1: Vector search using HNSW index
    const vectorSearchSubquery = tx
      .select({
        issueId: issueEmbeddings.issueId,
        distance: cosineDistance<number>(
          issueEmbeddings.embedding,
          embedding,
        ).as("distance"),
      })
      .from(issueEmbeddings)
      .orderBy(cosineDistance(issueEmbeddings.embedding, embedding))
      .limit(SIMILARITY_LIMIT)
      .as("vector_search");

    // Stage 2: Calculate ranking scores
    const recencyScore = calculateRecencyScore(issueTable.issueUpdatedAt);
    const commentScore = calculateCommentScore(issueTable.id);
    const similarityScore = calculateSimilarityScore(
      vectorSearchSubquery.distance,
    );
    const rankingScore = calculateRankingScore({
      similarityScore,
      recencyScore,
      commentScore,
      issueState: issueTable.issueState,
    });

    // Stage 3: Join and re-rank with additional features
    let query = tx
      .select({
        ...getBaseSelect(),
        similarityScore,
        rankingScore,
        totalCount: sql<number>`count(*) over()`.as("total_count"),
      })
      .from(vectorSearchSubquery)
      .innerJoin(issueTable, eq(vectorSearchSubquery.issueId, issueTable.id))
      .innerJoin(
        repos,
        and(eq(issueTable.repoId, repos.id), eq(repos.initStatus, "completed")),
      )
      .$dynamic();

    query = applyFilters(query, params, parsedSearchQuery);
    const finalQuery = applyPagination(query, params, offset).orderBy(
      desc(rankingScore),
    );

    // const result = await explainAnalyze(tx, finalQuery);
    const result = await finalQuery;
    const totalCount = result[0]?.totalCount ?? 0;

    return {
      data: result,
      totalCount,
    };
  });
}

async function filterBeforeVectorSearch(
  params: SearchParams,
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
  db: DbClient,
  embedding: number[],
) {
  const offset = (params.page - 1) * params.pageSize;

  return await db.transaction(async (tx) => {
    let query = tx
      .select({
        ...getBaseSelect(),
        distance: cosineDistance<number>(
          issueEmbeddings.embedding,
          embedding,
        ).as("distance"),
      })
      .from(issueTable)
      .innerJoin(issueEmbeddings, eq(issueTable.id, issueEmbeddings.issueId))
      .innerJoin(
        repos,
        and(eq(issueTable.repoId, repos.id), eq(repos.initStatus, "completed")),
      )
      .$dynamic();
    query = applyFilters(query, params, parsedSearchQuery);

    const vectorSearchSubquery = query
      .orderBy(cosineDistance(issueEmbeddings.embedding, embedding))
      .as("vector_search");

    const recencyScore = calculateRecencyScore(
      vectorSearchSubquery.issueUpdatedAt,
    );
    const commentScore = calculateCommentScore(vectorSearchSubquery.id);
    const similarityScore = calculateSimilarityScore(
      vectorSearchSubquery.distance,
    );
    const rankingScore = calculateRankingScore({
      similarityScore,
      recencyScore,
      commentScore,
      issueState: vectorSearchSubquery.issueState,
    });

    // Stage 2: Join and re-rank with additional features
    const joinedQuery = tx
      .select({
        // repeated, must keep in sync with getBaseSelect
        id: vectorSearchSubquery.id,
        number: vectorSearchSubquery.number,
        title: vectorSearchSubquery.title,
        labels: vectorSearchSubquery.labels,
        issueUrl: vectorSearchSubquery.issueUrl,
        author: vectorSearchSubquery.author,
        issueState: vectorSearchSubquery.issueState,
        issueStateReason: vectorSearchSubquery.issueStateReason,
        issueCreatedAt: vectorSearchSubquery.issueCreatedAt,
        issueClosedAt: vectorSearchSubquery.issueClosedAt,
        issueUpdatedAt: vectorSearchSubquery.issueUpdatedAt,
        repoName: vectorSearchSubquery.repoName,
        repoUrl: vectorSearchSubquery.repoUrl,
        repoOwnerName: vectorSearchSubquery.repoOwnerName,
        repoLastSyncedAt: vectorSearchSubquery.repoLastSyncedAt,
        commentCount: vectorSearchSubquery.commentCount,
        similarityScore,
        rankingScore,
        // Add window function to get total count in same query
        totalCount: sql<number>`count(*) over()`.as("total_count"),
      })
      .from(vectorSearchSubquery);

    const finalQuery = applyPagination(
      joinedQuery.$dynamic(),
      params,
      offset,
    ).orderBy(desc(rankingScore));

    // const result = await explainAnalyze(tx, finalQuery);
    const result = await finalQuery;
    // Extract total count from the first row
    const totalCount = result[0]?.totalCount ?? 0;
    return {
      data: result,
      totalCount,
    };
  });
}
