// would need to recalibrate normalization + score colors in IssueCard.tsx
// if we change weights/algorithm here

// Ranking weights (should sum to 1)
export const RANKING_WEIGHTS = {
  SEMANTIC_SIMILARITY: 0.8, // Start with higher weight for semantic search
  COMMENT_COUNT: 0.12, // Activity level
  RECENCY: 0.05, // Recent updates
  ISSUE_STATE: 0.03, // Small bonus for open issues
} as const;

// Time-based constants
export const TIME_CONSTANTS = {
  // Base time unit in days for recency calculation
  RECENCY_BASE_DAYS: 30,
} as const;

export const COMMENT_COUNT_CAP = 80;

// Score multipliers
export const SCORE_MULTIPLIERS = {
  OPEN_ISSUE: 1.0,
  CLOSED_ISSUE: 0.8,
} as const;

export const NORMALIZATION_ANCHOR = 0.65;
