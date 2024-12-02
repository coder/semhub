import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { SemanticSearch } from "@/core/semsearch";
import { db, openai } from "@/deps";

import type { Context } from "..";
import type { PaginatedResponse } from "../response";
import { issuesSearchSchema } from "./schema";

export const searchRouter = new Hono<Context>().get(
  "/",
  zValidator("query", issuesSearchSchema),
  async (c) => {
    const { q: query, page, lucky } = c.req.valid("query");
    const pageNumber = page ?? 1;
    const pageSize = 30;

    const issues = await SemanticSearch.getIssues(
      {
        query,
        rateLimiter: c.env.RATE_LIMITER,
        lucky: lucky === "y",
      },
      db,
      openai,
    );
    // unsure why, redirect doesn't work, redirect on client instead
    // if (lucky === "y" && issues[0]) {
    //   const { issueUrl } = issues[0];
    //   return c.redirect(issueUrl);
    // }
    const totalResults = issues.length;
    // infer type from data in future
    return c.json<PaginatedResponse<typeof issues>>(
      {
        data: issues,
        success: true,
        message: "Search results",
        pagination: {
          page: pageNumber,
          totalPages: Math.ceil(totalResults / pageSize),
        },
      },
      200,
    );
  },
);
