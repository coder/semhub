import { z } from "zod";

import type { StateSubmenuValue } from "../constants/search.constant";
import {
  SEARCH_OPERATORS,
  STATE_SUBMENU_VALUES,
} from "../constants/search.constant";
import { parseSearchQuery } from "./util";

export const operatorSchema = z.string().superRefine((query, ctx) => {
  // Check for operators with no value after colon
  SEARCH_OPERATORS.forEach(({ operator }) => {
    const emptyOperatorPattern = new RegExp(`${operator}:(?=\\s|$)`);
    if (emptyOperatorPattern.test(query)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `The <code>${operator}</code> operator requires a value after the colon`,
      });
    }
  });

  // Check for unquoted operators that require quotes
  SEARCH_OPERATORS.forEach(({ operator, enclosedInQuotes }) => {
    if (enclosedInQuotes) {
      const unquotedPattern = new RegExp(`${operator}:([^"\\s]+)(?=\\s|$)`);
      if (unquotedPattern.test(query)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `The <code>${operator}</code> operator requires quotes (") around its value`,
        });
      }
    }
  });
});

// currently only use this on frontend; it's more limiting that what our API can accept
// but these limits are in service of a better search result
export const searchQuerySchema = z.string().superRefine((query, ctx) => {
  const input = getInputForEmbedding(query);
  if (!input) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Please search for something specific or use the <code>title</code>, <code>body</code>, or <code>label</code> operators",
    });
  }

  // Run operator quote validation
  const quoteValidation = operatorSchema.safeParse(query);
  if (!quoteValidation.success) {
    quoteValidation.error.issues.forEach((issue) => ctx.addIssue(issue));
  }

  const { stateQueries, repoQueries, authorQueries, ownerQueries } =
    parseSearchQuery(query);

  if (repoQueries.length === 0 && ownerQueries.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please filter by either an org or a repo",
    });
  }
  if (repoQueries.length === 1 && ownerQueries.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please specify which org the repo belongs to",
    });
  }
  if (stateQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conflicting state filters in query",
    });
  }
  if (repoQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conflicting repo filters in query",
    });
  }
  if (authorQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conflicting author filters in query",
    });
  }
  if (ownerQueries.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conflicting org filters in query",
    });
  }
  if (stateQueries.length === 1) {
    const state = stateQueries[0]!.toLowerCase() as StateSubmenuValue;
    if (!STATE_SUBMENU_VALUES.includes(state)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Please filter by a valid state: ${STATE_SUBMENU_VALUES.map((v) => `<code>${v}</code>`).join(", ")}`,
      });
    }
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
    titleQueries.length === 0 &&
    labelQueries.length === 0
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
