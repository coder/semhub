import { z } from "zod";

import { SEARCH_OPERATORS } from "../constants/search.constant";
import { parseSearchQuery } from "./util";

export const operatorQuoteSchema = z.string().superRefine((query, ctx) => {
  // Check for unquoted operators that require quotes
  SEARCH_OPERATORS.forEach(({ operator, enclosedInQuotes }) => {
    if (enclosedInQuotes) {
      const unquotedPattern = new RegExp(`${operator}:([^"\\s]+)(?=\\s|$)`);
      if (unquotedPattern.test(query)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `The ${operator} operator requires quotes (") around its value`,
        });
      }
    }
  });
});

export const searchQuerySchema = z.string().superRefine((query, ctx) => {
  const input = getInputForEmbedding(query);
  if (!input) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please provide a substantive query",
    });
  }

  // Run operator quote validation
  const quoteValidation = operatorQuoteSchema.safeParse(query);
  if (!quoteValidation.success) {
    quoteValidation.error.issues.forEach((issue) => ctx.addIssue(issue));
  }

  const { stateQueries, repoQueries, authorQueries, ownerQueries } =
    parseSearchQuery(query);

  if (stateQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please filter by at most one state",
    });
  }
  if (repoQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please filter by at most one repo",
    });
  }
  if (authorQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please filter by at most one author",
    });
  }
  if (ownerQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please filter by at most one org",
    });
  }
});

export function getInputForEmbedding(query: string) {
  const {
    remainingQuery,
    bodyQueries,
    substringQueries,
    titleQueries,
    labelQueries,
  } = parseSearchQuery(query);
  if (
    remainingQuery.length === 0 &&
    bodyQueries.length === 0 &&
    substringQueries.length === 0 &&
    titleQueries.length === 0
  ) {
    // not enough to construct an embedding
    return null;
  }
  return [
    ...titleQueries.map((title) => `title:${title}`),
    ...labelQueries.map((label) => `labelled as ${label}`),
    ...bodyQueries,
    ...substringQueries,
    remainingQuery,
  ].join(",");
}
