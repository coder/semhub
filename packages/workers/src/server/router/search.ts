import { zValidator } from "@hono/zod-validator";
import { Embedding } from "@semhub/core/embedding";
import { Hono } from "hono";
import { z } from "zod";

import type { Context } from "..";
import type { PaginatedResponse } from "../response";
import { paginationSchema } from "../response";

const issuesSearchSchema = paginationSchema.extend({
  q: z.string(),
});

export const searchRouter = new Hono<Context>().get(
  "/",
  zValidator("query", issuesSearchSchema),
  async (c) => {
    const { q: query, p: pageNumber } = c.req.valid("query");
    const pageSize = 30;
    const issues = await Embedding.findSimilarIssues({
      query,
      rateLimiter: c.env.RATE_LIMITER,
    });

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
