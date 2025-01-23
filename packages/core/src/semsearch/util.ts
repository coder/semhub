// must use relative path because this file is used in web
import type { StateSubmenuValue } from "../constants/search.constant";
import {
  SEARCH_OPERATORS,
  STATE_SUBMENU_VALUES,
} from "../constants/search.constant";

export function parseSearchQuery(inputQuery: string) {
  // Create a Map with empty arrays as default values for each operator
  const operatorMatches = new Map(
    SEARCH_OPERATORS.map(({ operator }) => [operator, [] as string[]]),
  );
  let remainingQuery = inputQuery;

  // Process each operator according to its configuration
  SEARCH_OPERATORS.forEach((opConfig) => {
    const { operator, enclosedInQuotes } = opConfig;
    const pattern = enclosedInQuotes
      ? `${operator}:"([^"]*)"` // With quotes: title:"example"
      : `${operator}:(?:"([^"]*)"|([^\\s]*))`; // Match non-space value or quoted value (to allow users to use quotes even when not required; see query: 'author:"john smith"' in tests)

    const matches = inputQuery.match(new RegExp(pattern, "g"));
    if (matches) {
      // Extract the actual values based on the pattern
      operatorMatches.set(
        operator,
        matches
          .map((m) =>
            // when adding to the map, we want the value only (without operator or quotation marks)
            m.replace(
              new RegExp(
                `^${operator}:${enclosedInQuotes ? '"(.*)"' : "(.*)"}$`,
              ),
              "$1",
            ),
          )
          // we also don't want empty string
          .filter((value) => value.trim().length > 0),
      );
      // Remove matches from remaining query
      remainingQuery = matches.reduce(
        (query, match) => query.replace(match, ""),
        remainingQuery,
      );
    }
  });

  // Look for remaining quoted strings in the cleaned query
  const quotedMatches = remainingQuery.match(/"([^"]*)"/g);
  const substringQueries =
    quotedMatches
      ?.map((q) => q.slice(1, -1))
      // ignore empty string
      .filter((value) => value.trim().length > 0) ?? [];

  // extra handling for enums conversion
  const stateQueries = [
    ...new Set( // using set to remove duplicates
      operatorMatches
        .get("state")
        ?.map((q) => {
          const normalized = q.toLowerCase();
          return STATE_SUBMENU_VALUES.includes(normalized as StateSubmenuValue)
            ? normalized
            : null;
        })
        .filter((query): query is StateSubmenuValue => query !== null) ?? [],
    ),
  ];

  return {
    substringQueries,
    titleQueries: operatorMatches.get("title") ?? [],
    authorQueries: operatorMatches.get("author") ?? [],
    bodyQueries: operatorMatches.get("body") ?? [],
    labelQueries: operatorMatches.get("label") ?? [],
    stateQueries,
    repoQueries: operatorMatches.get("repo") ?? [],
    ownerQueries: operatorMatches.get("org") ?? [],
    collectionQueries: operatorMatches.get("collection") ?? [],
    remainingQuery: remainingQuery.trim(),
  };
}

export function modifyUserQuery(query: string) {
  const { stateQueries, repoQueries } = parseSearchQuery(query);
  let modifiedQuery = query.trim();

  // Add default state if none specified
  if (stateQueries.length === 0) {
    modifiedQuery = modifiedQuery
      ? `state:open ${modifiedQuery}`
      : "state:open";
  }

  // Handle org/repo format transformation
  const orgRepoQuery = repoQueries.find((query) => query.includes("/"));
  if (orgRepoQuery) {
    const parts = orgRepoQuery.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      // Remove all repo: and org: queries
      modifiedQuery = modifiedQuery
        .replace(/\brepo:(?:"[^"]*"|[^\s]*)/g, "")
        .replace(/\borg:(?:"[^"]*"|[^\s]*)/g, "")
        .trim();
      // Add back the transformed queries
      const prefix = `org:${parts[0]} repo:${parts[1]}`;
      modifiedQuery = modifiedQuery ? `${prefix} ${modifiedQuery}` : prefix;
    }
  }

  // Normalize spaces - replace multiple spaces with single space
  return modifiedQuery.replace(/\s+/g, " ").trim();
}
export function extractOwnerAndRepo(query: string) {
  const { ownerQueries, repoQueries } = parseSearchQuery(query);
  const owner = ownerQueries[0];
  const repo = repoQueries[0];
  if (!owner || !repo) {
    return null;
  }
  return { owner, repo };
}
