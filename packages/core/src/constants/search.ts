export const SEARCH_OPERATORS = [
  { operator: "title", enclosedInQuotes: true },
  { operator: "author", enclosedInQuotes: false },
  { operator: "body", enclosedInQuotes: true },
  { operator: "state", enclosedInQuotes: false },
  { operator: "repo", enclosedInQuotes: false },
  { operator: "label", enclosedInQuotes: false },
] as const;

export type SearchOperator = (typeof SEARCH_OPERATORS)[number]["operator"];

export const STATE_SUBMENU_VALUES = ["open", "closed", "all"] as const;
export type StateSubmenuValue = (typeof STATE_SUBMENU_VALUES)[number];
