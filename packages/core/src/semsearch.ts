import type { RateLimiter } from "./constants/rate-limit.constant";
import {
  RANKING_WEIGHTS,
  SCORE_MULTIPLIERS,
  TIME_CONSTANTS,
} from "./constants/search.constant";
import type { DbClient } from "./db";
import { and, cosineDistance, desc, eq, gt, ilike, or, sql } from "./db";
import { comments } from "./db/schema/entities/comment.sql";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import {
  convertToIssueStateSql,
  issueTable,
} from "./db/schema/entities/issue.sql";
import { hasAllLabels, labels } from "./db/schema/entities/label.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { count, lower } from "./db/utils/general";
import { jsonAggBuildObjectFromJoin, jsonContains } from "./db/utils/json";
import { Embedding } from "./embedding";
import type { OpenAIClient } from "./openai";
import { parseSearchQuery } from "./semsearch.util";

export namespace SemanticSearch {
  export async function getIssues(
    {
      query,
      rateLimiter,
      lucky = false,
    }: {
      query: string;
      rateLimiter: RateLimiter;
      lucky?: boolean;
    },
    db: DbClient,
    openai: OpenAIClient,
  ) {
    const SIMILARITY_THRESHOLD = 0.15; // arbitrary threshold, to be tuned

    const {
      substringQueries,
      titleQueries,
      authorQueries,
      bodyQueries,
      stateQueries,
      repoQueries,
      labelQueries,
      ownerQueries,
    } = parseSearchQuery(query);

    // Use the entire query for semantic search
    const embedding = await Embedding.createEmbedding(
      {
        input: query,
        rateLimiter,
      },
      openai,
    );
    const similarity = sql<number>`(1-(${cosineDistance(issueTable.embedding, embedding)}))::float`;

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

    // Combined ranking score
    const rankingScore = sql<number>`
      (${RANKING_WEIGHTS.SEMANTIC_SIMILARITY}::float * ${similarity}) +
      (${RANKING_WEIGHTS.RECENCY}::float * ${recencyScore}) +
      (${RANKING_WEIGHTS.COMMENT_COUNT}::float * ${commentScore}) +
      (${RANKING_WEIGHTS.ISSUE_STATE}::float * (
        CASE
          WHEN ${issueTable.issueState} = 'OPEN' THEN ${SCORE_MULTIPLIERS.OPEN_ISSUE}::float
          ELSE ${SCORE_MULTIPLIERS.CLOSED_ISSUE}::float
        END
      ))
    `;

    const selected = db
      .select({
        id: issueTable.id,
        number: issueTable.number,
        title: issueTable.title,
        // body: issues.body,
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
        repoOwnerName: repos.owner,
        repoLastSyncedAt: repos.lastSyncedAt,
        commentCount: count(comments.id).as("comment_count"),
        rankingScore,
      })
      .from(issueTable)
      .leftJoin(repos, eq(issueTable.repoId, repos.id))
      .leftJoin(comments, eq(comments.issueId, issueTable.id))
      // for aggregating comment count
      .groupBy(
        issueTable.id, // primary key covers all issues column
        repos.htmlUrl,
        repos.name,
        repos.owner,
        repos.lastSyncedAt,
      )
      .orderBy(desc(rankingScore))
      .where(
        and(
          eq(repos.initStatus, "completed"),
          // probably should switch to ranking score?
          gt(similarity, SIMILARITY_THRESHOLD),
          // general substring queries match either title or body
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
          ...ownerQueries.map((subQuery) => ilike(repos.owner, `${subQuery}`)),
          ...stateQueries.map((state) => convertToIssueStateSql(state)),
          ...[hasAllLabels(issueTable.id, labelQueries)],
        ),
      )
      .limit(lucky ? 1 : 50);
    // console.log("query", pgDialect.sqlToQuery(selected.getSQL()));
    const result = await selected;
    return result;
  }
}
