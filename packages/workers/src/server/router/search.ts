import { zValidator } from "@hono/zod-validator";
import { Embedding } from "@semhub/core/embedding";
import { Hono } from "hono";

import type { Context } from "..";
import type { PaginatedResponse } from "../response";
import { issuesSearchSchema } from "./schema";

export const searchRouter = new Hono<Context>().get(
  "/",
  zValidator("query", issuesSearchSchema),
  async (c) => {
    const { q: query, p, lucky } = c.req.valid("query");
    const pageNumber = p ?? 1;
    const pageSize = 30;
    const issues = await Embedding.findSimilarIssues({
      query,
      rateLimiter: c.env.RATE_LIMITER,
      lucky: lucky === "true",
    });
    // unsure why, redirect doesn't work, redirect on client instead
    // if (lucky && issues[0]) {
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
