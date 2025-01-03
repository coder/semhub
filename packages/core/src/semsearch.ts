import type { RateLimiter } from "./constants/rate-limit.constant";
import type { DbClient } from "./db";
import { and, cosineDistance, count as countFn, desc, eq, sql } from "./db";
import { issueEmbeddings } from "./db/schema/entities/issue-embedding.sql";
import { issueTable } from "./db/schema/entities/issue.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { createEmbedding } from "./embedding";
import type { OpenAIClient } from "./openai";
import {
  applyAccessControl,
  applyPaginationAndLimit,
  getBaseSelect,
  getOperatorsWhere,
} from "./semsearch.db";
import {
  calculateCommentScore,
  calculateRankingScore,
  calculateRecencyScore,
  calculateSimilarityScore,
} from "./semsearch.ranking";
import type { SearchParams } from "./semsearch.types";
import { parseSearchQuery } from "./semsearch.util";

export async function searchIssues(
  params: SearchParams,
  db: DbClient,
  openai: OpenAIClient,
  rateLimiter: RateLimiter,
) {
  const ISSUE_COUNT_THRESHOLD = 5000;
  const parsedSearchQuery = parseSearchQuery(params.query);
  // Get matching issues count and embedding in parallel
  const [matchingCount, embedding] = await Promise.all([
    getIssuesCount(params, parsedSearchQuery, db),
    createEmbedding(
      {
        input: params.query,
        rateLimiter,
      },
      openai,
    ),
  ]);
  const useHnswIndex = matchingCount > ISSUE_COUNT_THRESHOLD;
  return useHnswIndex
    ? // we are currently doing a hybrid search
      // if matchingCount is greater than ISSUE_COUNT_THRESHOLD, we search across all issues
      // using HNSW index and apply the filter afterwards
      // otherwise, we filter before the vector search and do a full scan
      // this is because if we use HNSW index for searches with strong filters, we end up with very few results
      await filterAfterVectorSearch(params, parsedSearchQuery, db, embedding)
    : await filterBeforeVectorSearch(params, parsedSearchQuery, db, embedding);
  // other possible solutions are:
  // (1) look into using hnsw.iterative_scan (previous attempt did not work well)
  // (2) try IVFFlat index instead of HNSW (see https://github.com/pgvector/pgvector/issues/560)
  // (2) see also: https://github.com/pgvector/pgvector?tab=readme-ov-file (sections on filtering, troubleshooting)
  // https://tembo.io/blog/vector-indexes-in-pgvector
}

async function getIssuesCount(
  searchParams: SearchParams,
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
  db: DbClient,
) {
  return db.transaction(async (tx) => {
    const baseQuery = tx
      .select({
        count: countFn(),
      })
      .from(issueTable)
      .leftJoin(
        repos,
        and(eq(issueTable.repoId, repos.id), eq(repos.initStatus, "completed")),
      );

    const conditionalJoin = applyAccessControl(
      baseQuery.$dynamic(),
      searchParams,
    );

    const getCountQuery = conditionalJoin.where(
      and(...getOperatorsWhere(parsedSearchQuery)),
    );

    const [result] = await getCountQuery;

    return result?.count ?? 0;
  });
}

async function filterAfterVectorSearch(
  params: SearchParams,
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
  db: DbClient,
  embedding: number[],
) {
  const SIMILARITY_LIMIT = 1000;
  const offset = (params.page - 1) * params.pageSize;

  return await db.transaction(async (tx) => {
    // Increase ef_search to get more candidates from HNSW
    await tx.execute(sql`SET LOCAL hnsw.ef_search = 1000;`);

    // Stage 1: Vector search using HNSW index with increased ef_search
    const vectorSearchSubquery = tx
      .select({
        issueId: issueEmbeddings.issueId,
        distance: cosineDistance(issueEmbeddings.embedding, embedding).as(
          "distance",
        ),
      })
      .from(issueEmbeddings)
      .orderBy(cosineDistance(issueEmbeddings.embedding, embedding))
      .limit(SIMILARITY_LIMIT)
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

    // Stage 2: Join and re-rank with additional features
    const base = tx
      .select({
        ...getBaseSelect(issueTable),
        similarityScore,
        rankingScore,
      })
      .from(vectorSearchSubquery)
      .innerJoin(issueTable, eq(vectorSearchSubquery.issueId, issueTable.id))
      .leftJoin(
        repos,
        and(eq(issueTable.repoId, repos.id), eq(repos.initStatus, "completed")),
      );

    // Step 3: apply various filters
    const conditionalJoin = applyAccessControl(base.$dynamic(), params);
    const baseQuery = conditionalJoin
      .orderBy(desc(rankingScore))
      .where(and(...getOperatorsWhere(parsedSearchQuery)));

    // Get total count (todo: concurrent)
    const [countResult] = await tx
      .select({ count: countFn() })
      .from(baseQuery.as("countQuery"));

    if (!countResult) {
      throw new Error("Failed to get total count");
    }
    const totalCount = countResult.count;

    // Get paginated results
    const finalQuery = applyPaginationAndLimit(baseQuery, params, offset);
    const result = await finalQuery;
    // const result = await explainAnalyze(tx, finalQuery);
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
    const vectorSearchSubquery = tx
      .select({
        ...getBaseSelect(issueTable),
        distance: cosineDistance(issueEmbeddings.embedding, embedding).as(
          "distance",
        ),
      })
      .from(issueTable)
      .innerJoin(issueEmbeddings, eq(issueTable.id, issueEmbeddings.issueId))
      .leftJoin(
        repos,
        and(
          eq(issueTable.repoId, repos.id),
          eq(repos.initStatus, "completed"),
          params.mode === "public" ? eq(repos.isPrivate, false) : undefined,
        ),
      );

    const conditionalJoin = applyAccessControl(
      vectorSearchSubquery.$dynamic(),
      params,
    );

    const finalVectorSearchSubquery = conditionalJoin
      .where(and(...getOperatorsWhere(parsedSearchQuery)))
      .orderBy(cosineDistance(issueEmbeddings.embedding, embedding))
      .as("vector_search");

    const recencyScore = calculateRecencyScore(
      finalVectorSearchSubquery.issueUpdatedAt,
    );
    const commentScore = calculateCommentScore(finalVectorSearchSubquery.id);
    const similarityScore = calculateSimilarityScore(
      finalVectorSearchSubquery.distance,
    );
    const rankingScore = calculateRankingScore({
      similarityScore,
      recencyScore,
      commentScore,
      issueState: finalVectorSearchSubquery.issueState,
    });

    // Stage 2: Join and re-rank with additional features
    const joinedQuery = tx
      .select({
        // repeated, must keep in sync with getBaseSelect
        id: finalVectorSearchSubquery.id,
        number: finalVectorSearchSubquery.number,
        title: finalVectorSearchSubquery.title,
        labels: finalVectorSearchSubquery.labels,
        issueUrl: finalVectorSearchSubquery.issueUrl,
        author: finalVectorSearchSubquery.author,
        issueState: finalVectorSearchSubquery.issueState,
        issueStateReason: finalVectorSearchSubquery.issueStateReason,
        issueCreatedAt: finalVectorSearchSubquery.issueCreatedAt,
        issueClosedAt: finalVectorSearchSubquery.issueClosedAt,
        issueUpdatedAt: finalVectorSearchSubquery.issueUpdatedAt,
        repoName: finalVectorSearchSubquery.repoName,
        repoUrl: finalVectorSearchSubquery.repoUrl,
        repoOwnerName: finalVectorSearchSubquery.repoOwnerName,
        repoLastSyncedAt: finalVectorSearchSubquery.repoLastSyncedAt,
        commentCount: finalVectorSearchSubquery.commentCount,
        similarityScore,
        rankingScore,
      })
      .from(finalVectorSearchSubquery)
      .orderBy(desc(rankingScore));

    // Get total count first
    const [countResult] = await tx
      .select({ count: countFn() })
      .from(joinedQuery.as("countQuery"));

    if (!countResult) {
      throw new Error("Failed to get total count");
    }
    const totalCount = countResult.count;

    // Get paginated results
    const finalQuery = applyPaginationAndLimit(
      joinedQuery.$dynamic(),
      params,
      offset,
    );
    const result = await finalQuery;
    // const result = await explainAnalyze(tx, finalQuery);
    return {
      data: result,
      totalCount,
    };
  });
}
