import type { RateLimiter } from "./constants/rate-limit.constant";
import {
  RANKING_WEIGHTS,
  SCORE_MULTIPLIERS,
  TIME_CONSTANTS,
} from "./constants/search.constant";
import type { DbClient } from "./db";
import {
  and,
  cosineDistance,
  count as countFn,
  desc,
  eq,
  ilike,
  or,
  sql,
} from "./db";
import { comments } from "./db/schema/entities/comment.sql";
import { issueEmbeddings } from "./db/schema/entities/issue-embedding.sql";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import {
  convertToIssueStateSql,
  issueTable,
} from "./db/schema/entities/issue.sql";
import { hasAllLabels, labels } from "./db/schema/entities/label.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { usersToRepos } from "./db/schema/entities/user-to-repo.sql";
import { lower } from "./db/utils/general";
import { jsonAggBuildObjectFromJoin, jsonContains } from "./db/utils/json";
import { createEmbedding } from "./embedding";
import type { OpenAIClient } from "./openai";
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
  // we are currently doing a hybrid search
  // if matchingCount is greater than ISSUE_COUNT_THRESHOLD, we search across all issues
  // using HNSW index and apply the filter afterwards
  // otherwise, we filter before the vector search and do a full scan
  // this is because if we use HNSW index for searches with strong filters, we end up with very few results

  // other possible solutions are:
  // (1) look into using hnsw.iterative_scan (previous attempt did not work well)
  // (2) try IVFFlat index instead of HNSW (see https://github.com/pgvector/pgvector/issues/560)
  // (2) see also: https://github.com/pgvector/pgvector?tab=readme-ov-file (sections on filtering, troubleshooting)
  // https://tembo.io/blog/vector-indexes-in-pgvector
  const { data, totalCount } = useHnswIndex
    ? await filterAfterVectorSearch(params, parsedSearchQuery, db, embedding)
    : await filterBeforeVectorSearch(params, parsedSearchQuery, db, embedding);
  return {
    data,
    totalCount,
  };
}

async function getIssuesCount(
  searchParams: SearchParams,
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
  db: DbClient,
) {
  return db.transaction(async (tx) => {
    const {
      substringQueries,
      titleQueries,
      authorQueries,
      bodyQueries,
      stateQueries,
      repoQueries,
      labelQueries,
      ownerQueries,
    } = parsedSearchQuery;
    const baseQuery = tx
      .select({
        count: countFn(),
      })
      .from(issueTable)
      .leftJoin(
        repos,
        and(
          eq(issueTable.repoId, repos.id),
          eq(repos.initStatus, "completed"),
          searchParams.mode === "public"
            ? eq(repos.isPrivate, false)
            : undefined,
        ),
      );

    const conditionalJoin =
      searchParams.mode === "public"
        ? baseQuery
        : baseQuery.innerJoin(
            usersToRepos,
            and(
              eq(usersToRepos.repoId, repos.id),
              eq(usersToRepos.userId, searchParams.userId),
              eq(usersToRepos.status, "active"),
            ),
          );

    const [result] = await conditionalJoin.where(
      and(
        ...substringQueries.map((subQuery) =>
          or(
            ilike(issueTable.title, `%${subQuery}%`),
            ilike(issueTable.body, `%${subQuery}%`),
          ),
        ),
        ...titleQueries.map((subQuery) =>
          ilike(issueTable.title, `%${subQuery}%`),
        ),
        ...bodyQueries.map((subQuery) =>
          ilike(issueTable.body, `%${subQuery}%`),
        ),
        ...authorQueries.map((subQuery) =>
          eq(
            lower(jsonContains(issueTable.author, "name")),
            subQuery.toLowerCase(),
          ),
        ),
        ...repoQueries.map((subQuery) => ilike(repos.name, `${subQuery}`)),
        ...ownerQueries.map((subQuery) =>
          ilike(repos.ownerLogin, `${subQuery}`),
        ),
        ...stateQueries.map((state) => convertToIssueStateSql(state)),
        ...[hasAllLabels(issueTable.id, labelQueries)],
      ),
    );

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
  const {
    substringQueries,
    titleQueries,
    authorQueries,
    bodyQueries,
    stateQueries,
    repoQueries,
    labelQueries,
    ownerQueries,
  } = parsedSearchQuery;
  return await db.transaction(async (tx) => {
    // Increase ef_search to get more candidates from HNSW
    await tx.execute(sql`SET LOCAL hnsw.ef_search = 1000;`);
    // tried modifying `hnsw.iterative_scan` but this resulted in sequential scans
    // for more results, probably should try IVFFlat index instead of HNSW
    // see https://github.com/pgvector/pgvector/issues/560

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
      .limit(SIMILARITY_LIMIT) // important to have limit to get postgres to use HNSW index
      .as("vector_search");

    // Exponential decay for recency score
    // exp(-t/τ) where:
    // t is time elapsed in days
    // τ (tau) is the characteristic decay time in days
    // After 30 days (RECENCY_BASE_DAYS), score will be ~0.37 (1/e)
    // After 60 days, score will be ~0.14 (1/e²)
    // Score approaches but never reaches 0
    const recencyScore = sql<number>`
      EXP(
        -1.0 *
        EXTRACT(EPOCH FROM (NOW() - ${issueTable.issueUpdatedAt}))::float /
        (86400 * ${TIME_CONSTANTS.RECENCY_BASE_DAYS})  -- Convert decay time to seconds
      )::float
    `;

    // Logarithmic comment score normalization
    // ln(x + 1) gives us:
    // 0 comments = 0.0
    // 4 comments ≈ 1.6
    // 5 comments ≈ 1.8
    // 10 comments ≈ 2.4
    // 20 comments ≈ 3.0
    // 50 comments ≈ 3.9
    // Then normalize to 0-1 range by dividing by ln(50 + 1)
    const commentScore = sql<number>`
      LN(GREATEST((SELECT count(*) FROM ${comments} WHERE ${comments.issueId} = ${issueTable.id})::float + 1, 1)) /
      LN(51)  -- ln(50 + 1) ≈ 3.93 as normalizing factor
    `;

    // Convert vector distance to similarity score (1 - distance)
    const similarityScore = sql<number>`(1 - ${vectorSearchSubquery.distance})::float`;

    // Combined ranking score
    const rankingScore = sql<number>`
      (${RANKING_WEIGHTS.SEMANTIC_SIMILARITY}::float * ${similarityScore}) +
      (${RANKING_WEIGHTS.RECENCY}::float * ${recencyScore}) +
      (${RANKING_WEIGHTS.COMMENT_COUNT}::float * ${commentScore}) +
      (${RANKING_WEIGHTS.ISSUE_STATE}::float * (
        CASE
          WHEN ${issueTable.issueState} = 'OPEN' THEN ${SCORE_MULTIPLIERS.OPEN_ISSUE}::float
          ELSE ${SCORE_MULTIPLIERS.CLOSED_ISSUE}::float
        END
      ))
    `;

    // Stage 2: Join and re-rank with additional features
    const base = tx
      .select({
        id: issueTable.id,
        number: issueTable.number,
        title: issueTable.title,
        labels: jsonAggBuildObjectFromJoin(
          {
            name: labels.name,
            color: labels.color,
            description: labels.description,
          },
          {
            from: issuesToLabels,
            joinTable: labels,
            joinCondition: eq(labels.id, issuesToLabels.labelId),
            whereCondition: eq(issuesToLabels.issueId, issueTable.id),
          },
        ),
        issueUrl: issueTable.htmlUrl,
        author: issueTable.author,
        issueState: issueTable.issueState,
        issueStateReason: issueTable.issueStateReason,
        issueCreatedAt: issueTable.issueCreatedAt,
        issueClosedAt: issueTable.issueClosedAt,
        issueUpdatedAt: issueTable.issueUpdatedAt,
        repoName: repos.name,
        repoUrl: repos.htmlUrl,
        repoOwnerName: repos.ownerLogin,
        repoLastSyncedAt: repos.lastSyncedAt,
        commentCount:
          sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.issueId} = ${issueTable.id})`.as(
            "comment_count",
          ),
        similarityScore,
        rankingScore,
      })
      .from(vectorSearchSubquery)
      .innerJoin(issueTable, eq(vectorSearchSubquery.issueId, issueTable.id))
      .leftJoin(repos, eq(issueTable.repoId, repos.id));

    const conditionalJoin =
      params.mode === "public"
        ? base
        : base.innerJoin(
            usersToRepos,
            and(
              eq(usersToRepos.repoId, repos.id),
              eq(usersToRepos.userId, params.userId),
              eq(usersToRepos.status, "active"),
              // can add unsubscribedAt not null?
            ),
          );

    const baseQuery = conditionalJoin.orderBy(desc(rankingScore)).where(
      and(
        eq(repos.initStatus, "completed"),
        params.mode === "public" ? eq(repos.isPrivate, false) : undefined,
        ...substringQueries.map((subQuery) =>
          or(
            ilike(issueTable.title, `%${subQuery}%`),
            ilike(issueTable.body, `%${subQuery}%`),
          ),
        ),
        ...titleQueries.map((subQuery) =>
          ilike(issueTable.title, `%${subQuery}%`),
        ),
        ...bodyQueries.map((subQuery) =>
          ilike(issueTable.body, `%${subQuery}%`),
        ),
        ...authorQueries.map((subQuery) =>
          // cannot use ILIKE because name is stored in JSONB
          eq(
            lower(jsonContains(issueTable.author, "name")),
            subQuery.toLowerCase(),
          ),
        ),
        ...repoQueries.map((subQuery) => ilike(repos.name, `${subQuery}`)),
        ...ownerQueries.map((subQuery) =>
          ilike(repos.ownerLogin, `${subQuery}`),
        ),
        ...stateQueries.map((state) => convertToIssueStateSql(state)),
        ...[hasAllLabels(issueTable.id, labelQueries)],
      ),
    );

    // Get total count first
    const [countResult] = await tx
      .select({ count: countFn() })
      .from(baseQuery.as("countQuery"));

    if (!countResult) {
      throw new Error("Failed to get total count");
    }
    const totalCount = countResult.count;

    // Get paginated results
    const finalQuery =
      params.mode === "public" && params.lucky
        ? baseQuery.limit(1)
        : baseQuery.limit(params.pageSize).offset(offset);

    const result = await finalQuery;
    return {
      data: result,
      totalCount: totalCount ?? 0,
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
  const {
    substringQueries,
    titleQueries,
    authorQueries,
    bodyQueries,
    stateQueries,
    repoQueries,
    labelQueries,
    ownerQueries,
  } = parsedSearchQuery;
  return await db.transaction(async (tx) => {
    const vectorSearchSubquery = tx
      .select({
        id: issueTable.id,
        number: issueTable.number,
        title: issueTable.title,
        labels: jsonAggBuildObjectFromJoin(
          {
            name: labels.name,
            color: labels.color,
            description: labels.description,
          },
          {
            from: issuesToLabels,
            joinTable: labels,
            joinCondition: eq(labels.id, issuesToLabels.labelId),
            whereCondition: eq(issuesToLabels.issueId, issueTable.id),
          },
        ).as("labels"),
        issueUrl: sql<string>`${issueTable.htmlUrl}`.as("issueUrl"),
        author: issueTable.author,
        issueState: issueTable.issueState,
        issueStateReason: issueTable.issueStateReason,
        issueCreatedAt: issueTable.issueCreatedAt,
        issueClosedAt: issueTable.issueClosedAt,
        issueUpdatedAt: issueTable.issueUpdatedAt,
        repoName: repos.name,
        repoUrl: sql<string>`${repos.htmlUrl}`.as("repoUrl"),
        repoOwnerName: repos.ownerLogin,
        repoLastSyncedAt: repos.lastSyncedAt,
        commentCount:
          sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.issueId} = ${issueTable.id})`.as(
            "comment_count",
          ),
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

    const conditionalJoin =
      params.mode === "public"
        ? vectorSearchSubquery
        : vectorSearchSubquery.innerJoin(
            usersToRepos,
            and(
              eq(usersToRepos.repoId, repos.id),
              eq(usersToRepos.userId, params.userId),
              eq(usersToRepos.status, "active"),
              // can add unsubscribedAt not null?
            ),
          );
    const finalVectorSearchSubquery = conditionalJoin
      .where(
        and(
          ...substringQueries.map((subQuery) =>
            or(
              ilike(issueTable.title, `%${subQuery}%`),
              ilike(issueTable.body, `%${subQuery}%`),
            ),
          ),
          ...titleQueries.map((subQuery) =>
            ilike(issueTable.title, `%${subQuery}%`),
          ),
          ...bodyQueries.map((subQuery) =>
            ilike(issueTable.body, `%${subQuery}%`),
          ),
          ...authorQueries.map((subQuery) =>
            // cannot use ILIKE because name is stored in JSONB
            eq(
              lower(jsonContains(issueTable.author, "name")),
              subQuery.toLowerCase(),
            ),
          ),
          ...repoQueries.map((subQuery) => ilike(repos.name, `${subQuery}`)),
          ...ownerQueries.map((subQuery) =>
            ilike(repos.ownerLogin, `${subQuery}`),
          ),
          ...stateQueries.map((state) => convertToIssueStateSql(state)),
          ...[hasAllLabels(issueTable.id, labelQueries)],
        ),
      )
      .orderBy(cosineDistance(issueEmbeddings.embedding, embedding))
      .as("vector_search");

    // Exponential decay for recency score
    // exp(-t/τ) where:
    // t is time elapsed in days
    // τ (tau) is the characteristic decay time in days
    // After 30 days (RECENCY_BASE_DAYS), score will be ~0.37 (1/e)
    // After 60 days, score will be ~0.14 (1/e²)
    // Score approaches but never reaches 0
    const recencyScore = sql<number>`
      EXP(
        -1.0 *
        EXTRACT(EPOCH FROM (NOW() - ${finalVectorSearchSubquery.issueUpdatedAt}))::float /
        (86400 * ${TIME_CONSTANTS.RECENCY_BASE_DAYS})  -- Convert decay time to seconds
      )::float
    `;

    // Logarithmic comment score normalization
    // ln(x + 1) gives us:
    // 0 comments = 0.0
    // 4 comments ≈ 1.6
    // 5 comments ≈ 1.8
    // 10 comments ≈ 2.4
    // 20 comments ≈ 3.0
    // 50 comments ≈ 3.9
    // Then normalize to 0-1 range by dividing by ln(50 + 1)
    const commentScore = sql<number>`
      LN(GREATEST((${finalVectorSearchSubquery.commentCount})::float + 1, 1)) /
      LN(51)  -- ln(50 + 1) ≈ 3.93 as normalizing factor
    `;

    // Convert vector distance to similarity score (1 - distance)
    const similarityScore = sql<number>`(1 - ${finalVectorSearchSubquery.distance})::float`;

    // Combined ranking score
    const rankingScore = sql<number>`
      (${RANKING_WEIGHTS.SEMANTIC_SIMILARITY}::float * ${similarityScore}) +
      (${RANKING_WEIGHTS.RECENCY}::float * ${recencyScore}) +
      (${RANKING_WEIGHTS.COMMENT_COUNT}::float * ${commentScore}) +
      (${RANKING_WEIGHTS.ISSUE_STATE}::float * (
        CASE
          WHEN ${finalVectorSearchSubquery.issueState} = 'OPEN' THEN ${SCORE_MULTIPLIERS.OPEN_ISSUE}::float
          ELSE ${SCORE_MULTIPLIERS.CLOSED_ISSUE}::float
        END
      ))
    `;

    // Stage 2: Join and re-rank with additional features
    const joinedQuery = tx
      .select({
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
    const finalQuery =
      params.mode === "public" && params.lucky
        ? joinedQuery.limit(1)
        : joinedQuery.limit(params.pageSize).offset(offset);

    const result = await finalQuery;
    return {
      data: result,
      totalCount: totalCount ?? 0,
    };
  });
}
type BaseSearchParams = {
  query: string;
  page: number;
  pageSize: number;
};

type PublicSearchParams = BaseSearchParams & {
  mode: "public";
  lucky?: boolean;
};

type MeSearchParams = BaseSearchParams & {
  mode: "me";
  userId: string;
};

type SearchParams = PublicSearchParams | MeSearchParams;
