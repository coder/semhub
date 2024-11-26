import type { StateSubmenuValue } from "./constants/search";
import { SEARCH_OPERATORS, STATE_SUBMENU_VALUES } from "./constants/search";

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
    repoQueries: operatorMatches.get("repo") ?? [],
    labelQueries: operatorMatches.get("label") ?? [],
    stateQueries,
  };
}
