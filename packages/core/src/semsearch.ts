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
import { count, lower } from "./db/utils/general";
import { jsonAggBuildObjectFromJoin, jsonContains } from "./db/utils/json";
import { createEmbedding } from "./embedding";
import type { OpenAIClient } from "./openai";
import { parseSearchQuery } from "./semsearch.util";

export const SemanticSearch = {
  getIssues: async (
    params: SearchParams,
    db: DbClient,
    openai: OpenAIClient,
    rateLimiter: RateLimiter,
  ) => {
    // const SIMILARITY_THRESHOLD = 0.0001; // Lowered from 0.15 to get more candidates
    // const SIMILARITY_LIMIT = 5000; // Limit for first-stage vector search
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
    } = parseSearchQuery(params.query);

    // Use the entire query for semantic search
    const embedding = await createEmbedding(
      {
        input: params.query,
        rateLimiter,
      },
      openai,
    );

    const { data, totalCount } = await db.transaction(async (tx) => {
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
        .limit(5000) // important to have limit to get postgres to use HNSW index
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
      LN(GREATEST(count(${comments.id})::float + 1, 1)) /
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
          commentCount: count(comments.id).as("comment_count"),
          similarityScore,
          rankingScore,
        })
        .from(vectorSearchSubquery)
        .innerJoin(issueTable, eq(vectorSearchSubquery.issueId, issueTable.id))
        .leftJoin(repos, eq(issueTable.repoId, repos.id))
        .leftJoin(comments, eq(comments.issueId, issueTable.id));

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

      const baseQuery = conditionalJoin
        .groupBy(
          issueTable.id, // primary key covers all issues column
          repos.htmlUrl,
          repos.name,
          repos.ownerLogin,
          repos.lastSyncedAt,
          vectorSearchSubquery.distance,
        )
        .orderBy(desc(rankingScore))
        .where(
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
    return {
      data,
      totalCount,
    };
  },
};

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
