export const SEARCH_OPERATORS = [
  { operator: "title", enclosedInQuotes: true },
  { operator: "author", enclosedInQuotes: false },
  { operator: "body", enclosedInQuotes: true },
  { operator: "state", enclosedInQuotes: false },
  { operator: "repo", enclosedInQuotes: false },
  { operator: "label", enclosedInQuotes: true },
  { operator: "owner", enclosedInQuotes: false },
] as const;

export type SearchOperator = (typeof SEARCH_OPERATORS)[number]["operator"];

export const STATE_SUBMENU_VALUES = ["open", "closed", "all"] as const;
export type StateSubmenuValue = (typeof STATE_SUBMENU_VALUES)[number];

// Ranking weights (should sum to 1)
export const RANKING_WEIGHTS = {
  SEMANTIC_SIMILARITY: 0.5, // Start with higher weight for semantic search
  COMMENT_COUNT: 0.25, // Activity level
  RECENCY: 0.2, // Recent updates
  ISSUE_STATE: 0.05, // Small bonus for open issues
} as const;

// Time-based constants
export const TIME_CONSTANTS = {
  // Base time unit in days for recency calculation
  RECENCY_BASE_DAYS: 30,
} as const;

// Score multipliers
export const SCORE_MULTIPLIERS = {
  OPEN_ISSUE: 1.0,
  CLOSED_ISSUE: 0.8,
} as const;
