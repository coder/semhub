import type { DbClient } from "@/db";
import { and, desc, eq, sql } from "@/db";
import { issueEmbeddings } from "@/db/schema/entities/issue-embedding.sql";
import { issueTable } from "@/db/schema/entities/issue.sql";
import { repos } from "@/db/schema/entities/repo.sql";
import { convertToSqlRaw, getEstimatedCount } from "@/db/utils/general";
import { cosineDistance } from "@/db/utils/vector";
import { createEmbedding } from "@/embedding";
import type { OpenAIClient } from "@/openai";
import { type AwsLambdaConfig } from "@/util/aws";

import { applyFilters, applyPagination, getBaseSelect } from "./db";
import { invokeLambdaSearch } from "./lambda";
import {
  HNSW_EF_SEARCH,
  HNSW_ISSUE_COUNT_THRESHOLD,
  HNSW_MAX_SCAN_TUPLES,
  HNSW_SCAN_MEM_MULTIPLIER,
  SEQ_SCAN_THRESHOLD,
  VECTOR_SIMILARITY_SEARCH_LIMIT,
} from "./params";
import {
  calculateCommentScore,
  calculateRankingScore,
  calculateRecencyScore,
  calculateSimilarityScore,
} from "./ranking";
import type { SearchParams, SearchResult } from "./schema";
import { parseSearchQuery } from "./util";

export async function routeSearch(
  params: SearchParams,
  db: DbClient,
  openai: OpenAIClient,
  lambdaConfig: AwsLambdaConfig,
): Promise<SearchResult> {
  const { matchingCount, totalCount, embedding } =
    await getApproxCountsAndEmbedding(params, db, openai);
  const useHnswIndex = matchingCount > HNSW_ISSUE_COUNT_THRESHOLD;
  const result = useHnswIndex
    ? await filterAfterVectorSearch(params, db, embedding)
    : await filterBeforeVectorSearch(params, db, embedding);
  if (matchingCount <= SEQ_SCAN_THRESHOLD) {
    return await filterBeforeVectorSearch(params, db, embedding);
  }

  // If more than 1000 issues, use lambda
  // TODO: if this approach works well, we can remove the HNSW index from the database
  const lambdaResponse = await invokeLambdaSearch(
    {
      query: params.query,
      embedding,
    },
    lambdaConfig,
  );

  return result;
}

async function getApproxCountsAndEmbedding(
  params: SearchParams,
  db: DbClient,
  openai: OpenAIClient,
) {
  const parsedSearchQuery = parseSearchQuery(params.query);
  const [matchingCount, totalCount, embedding] = await Promise.all([
    getFilteredIssuesApproxCount(params, db),
    getTotalIssueEmbeddingApproxCount(db),
    createEmbedding(
      {
        input: parsedSearchQuery.remainingQuery ?? params.query,
      },
      openai,
    ),
  ]);
  return { matchingCount, totalCount, embedding };
}

async function getFilteredIssuesApproxCount(
  searchParams: SearchParams,
  db: DbClient,
) {
  let query = db
    .select({
      id: issueTable.id,
    })
    .from(issueTable)
    .innerJoin(
      repos,
      and(eq(issueTable.repoId, repos.id), eq(repos.initStatus, "completed")),
    )
    .$dynamic();

  query = applyFilters(query, searchParams);
  // TODO: in the future, can store in KV cache
  const approxCount = await getEstimatedCount(query, db);
  if (approxCount === null) {
    throw new Error("getEstimatedCount failed");
  }
  return approxCount;
}

/**
 * Gets an approximate count of issue embeddings using PostgreSQL's statistics.
 * This is much faster than COUNT(*) but may be slightly out of date as it relies
 * on statistics that are updated by ANALYZE operations.
 */
async function getTotalIssueEmbeddingApproxCount(db: DbClient) {
  const [result] = await db.execute(
    sql`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'issue_embeddings'`,
  );

  if (!result || !("estimate" in result)) {
    throw new Error("Failed to get estimate from pg_class");
  }

  return Number(result.estimate);
}

async function filterAfterVectorSearch(
  params: SearchParams,
  db: DbClient,
  embedding: number[],
) {
  const offset = (params.page - 1) * params.pageSize;

  return await db.transaction(async (tx) => {
    // adjust this to trade-off between speed and number of eventual matches
    await tx.execute(
      sql`SET LOCAL hnsw.ef_search = ${convertToSqlRaw(HNSW_EF_SEARCH)};`,
    );
    // this is default value
    await tx.execute(
      sql`SET LOCAL hnsw.max_scan_tuples = ${convertToSqlRaw(
        HNSW_MAX_SCAN_TUPLES,
      )};`,
    );
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = 'relaxed_order';`);
    await tx.execute(
      sql`SET LOCAL hnsw.scan_mem_multiplier = ${convertToSqlRaw(
        HNSW_SCAN_MEM_MULTIPLIER,
      )};`,
    );

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
      .limit(VECTOR_SIMILARITY_SEARCH_LIMIT)
      .as("vector_search");

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

    let query = tx
      .select({
        ...getBaseSelect(),
        similarityScore,
        rankingScore,
        // Add a window function to get the total count in the same query
        totalCount: sql<number>`count(*) over()`.as("total_count"),
      })
      .from(vectorSearchSubquery)
      .innerJoin(issueTable, eq(vectorSearchSubquery.issueId, issueTable.id))
      .innerJoin(
        repos,
        and(eq(issueTable.repoId, repos.id), eq(repos.initStatus, "completed")),
      )
      .$dynamic();

    query = applyFilters(query, params);
    const finalQuery = applyPagination(query, params, offset).orderBy(
      desc(rankingScore),
    );

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

    query = applyFilters(query, params);

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

    const result = await finalQuery;
    const totalCount = result[0]?.totalCount ?? 0;

    return {
      data: result,
      totalCount,
    };
  });
}
