// must use relative path because this file is used in web
import { SEARCH_OPERATORS } from "../constants/search.constant";

export function parseSearchQuery(inputQuery: string) {
  // Create a Map with empty Sets as default values for each operator
  const operatorMatches = new Map(
    SEARCH_OPERATORS.map(({ operator }) => [operator, new Set<string>()]),
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
      matches
        .map((m) =>
          // when adding to the map, we want the value only (without operator or quotation marks)
          m.replace(
            new RegExp(`^${operator}:${enclosedInQuotes ? '"(.*)"' : "(.*)"}$`),
            "$1",
          ),
        )
        // we also don't want empty string
        .filter((value) => value.trim().length > 0)
        .forEach((value) => operatorMatches.get(operator)?.add(value));
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

  return {
    substringQueries,
    titleQueries: Array.from(operatorMatches.get("title") ?? []),
    authorQueries: Array.from(operatorMatches.get("author") ?? []),
    bodyQueries: Array.from(operatorMatches.get("body") ?? []),
    labelQueries: Array.from(operatorMatches.get("label") ?? []),
    stateQueries: Array.from(operatorMatches.get("state") ?? []),
    repoQueries: Array.from(operatorMatches.get("repo") ?? []),
    ownerQueries: Array.from(operatorMatches.get("org") ?? []),
    collectionQueries: Array.from(operatorMatches.get("collection") ?? []),
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
