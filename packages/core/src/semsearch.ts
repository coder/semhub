import type { DbClient } from "./db";
import { and, count as countFn, desc, eq, sql } from "./db";
import { issueEmbeddings } from "./db/schema/entities/issue-embedding.sql";
import { issueTable } from "./db/schema/entities/issue.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { convertToSqlRaw } from "./db/utils/general";
import { cosineDistance } from "./db/utils/vector";
import { createEmbedding } from "./embedding";
import type { OpenAIClient } from "./openai";
import { applyFilters, applyPagination, getBaseSelect } from "./semsearch.db";
import {
  HNSW_EF_SEARCH,
  HNSW_ISSUE_COUNT_THRESHOLD,
  HNSW_MAX_SCAN_TUPLES,
  HNSW_SCAN_MEM_MULTIPLIER,
  VECTOR_SIMILARITY_SEARCH_LIMIT,
} from "./semsearch.param";
import {
  calculateCommentScore,
  calculateRankingScore,
  calculateRecencyScore,
  calculateSimilarityScore,
} from "./semsearch.ranking";
import type { SearchParams, SearchResult } from "./semsearch.schema";
import { parseSearchQuery } from "./semsearch.util";

export async function searchIssues(
  params: SearchParams,
  db: DbClient,
  openai: OpenAIClient,
): Promise<SearchResult> {
  // setting the query at 25000 issues, sequential scan takes around 3 seconds (which is still acceptable)
  // sequential scans scales at O(n^2), so at higher thresholds, HNSW index starts to outperform
  // tested with 50k issues, HNSW takes 8 seconds, seq scan takes 18 seconds
  const parsedSearchQuery = parseSearchQuery(params.query);

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

  const useHnswIndex = matchingCount > HNSW_ISSUE_COUNT_THRESHOLD;
  // (1) if higher, we HNSW index and apply the filter afterwards
  // (2) if lower, we filter before the vector search and do a full seq scan
  // downside of (1) if searching across not that many issues: end up with very few results
  // downside of (2) if searching across too many issues:queries are too slow
  const result = useHnswIndex
    ? await filterAfterVectorSearch(params, parsedSearchQuery, db, embedding)
    : await filterBeforeVectorSearch(params, parsedSearchQuery, db, embedding);
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

    query = applyFilters(query, params, parsedSearchQuery);
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
