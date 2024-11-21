export const SEARCH_OPERATORS = [
  "title",
  "author",
  "body",
  "state",
  "repo",
] as const;

export type SearchOperator = (typeof SEARCH_OPERATORS)[number];
