import type { AnyColumn, SQL } from "@/db";
import { sql } from "@/db";
import { comments } from "@/db/schema/entities/comment.sql";

// would need to recalibrate normalization + score colors in IssueCard.tsx
// if we change weights/algorithm here

// Ranking weights (should sum to 1)
const RANKING_WEIGHTS = {
  SEMANTIC_SIMILARITY: 0.8, // Start with higher weight for semantic search
  COMMENT_COUNT: 0.12, // Activity level
  RECENCY: 0.05, // Recent updates
  ISSUE_STATE: 0.03, // Small bonus for open issues
} as const;

// Time-based constants
const TIME_CONSTANTS = {
  // Base time unit in days for recency calculation
  RECENCY_BASE_DAYS: 30,
} as const;

// Score multipliers
const SCORE_MULTIPLIERS = {
  OPEN_ISSUE: 1.0,
  CLOSED_ISSUE: 0.8,
} as const;
/**
 * Calculates recency score using exponential decay
 * exp(-t/τ) where:
 * t is time elapsed in days
 * τ (tau) is the characteristic decay time in days
 * After 30 days (RECENCY_BASE_DAYS), score will be ~0.37 (1/e)
 * After 60 days, score will be ~0.14 (1/e²)
 * Score approaches but never reaches 0
 */
export function calculateRecencyScore(issueUpdatedAtColumn: SQL | AnyColumn) {
  return sql<number>`
    EXP(
      -1.0 *
      EXTRACT(EPOCH FROM (NOW() - ${issueUpdatedAtColumn}))::float /
      (86400 * ${TIME_CONSTANTS.RECENCY_BASE_DAYS})  -- Convert decay time to seconds
    )::float
  `;
}

/**
 * Calculates comment score using logarithmic normalization
 * ln(x + 1) gives us:
 * 0 comments = 0.0
 * 4 comments ≈ 1.6
 * 5 comments ≈ 1.8
 * 10 comments ≈ 2.4
 * 20 comments ≈ 3.0
 * 50 comments ≈ 3.9
 * Then normalize to 0-1 range by dividing by ln(50 + 1)
 */
export function calculateCommentScore(issueId: SQL | AnyColumn) {
  return sql<number>`
    LN(GREATEST((SELECT count(*) FROM ${comments} WHERE ${comments.issueId} = ${issueId})::float + 1, 1)) /
    LN(51)  -- ln(50 + 1) ≈ 3.93 as normalizing factor
  `;
}

/**
 * Converts vector distance to similarity score (1 - distance)
 */
export function calculateSimilarityScore(distance: SQL.Aliased<number>) {
  return sql<number>`(1 - ${distance})::float`;
}

/**
 * Calculates the combined ranking score using all components
 */
export function calculateRankingScore({
  similarityScore,
  recencyScore,
  commentScore,
  issueState,
}: {
  similarityScore: SQL;
  recencyScore: SQL;
  commentScore: SQL;
  issueState: SQL | AnyColumn;
}) {
  return sql<number>`
    (${RANKING_WEIGHTS.SEMANTIC_SIMILARITY}::float * ${similarityScore}) +
    (${RANKING_WEIGHTS.RECENCY}::float * ${recencyScore}) +
    (${RANKING_WEIGHTS.COMMENT_COUNT}::float * ${commentScore}) +
    (${RANKING_WEIGHTS.ISSUE_STATE}::float * (
      CASE
        WHEN ${issueState} = 'OPEN' THEN ${SCORE_MULTIPLIERS.OPEN_ISSUE}::float
        ELSE ${SCORE_MULTIPLIERS.CLOSED_ISSUE}::float
      END
    ))
  `;
}
