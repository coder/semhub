import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { SemanticSearch } from "@/core/semsearch";
import { getDeps } from "@/deps";
import type { Context } from "@/server";
import { createPaginatedResponse } from "@/server/response";
import { meSearchSchema } from "@/server/router/schema/search.schema";

export const searchRouter = new Hono<Context>().get(
  "/",
  zValidator("query", meSearchSchema),
  async (c) => {
    const { q: query, page } = c.req.valid("query");
    const pageNumber = page ?? 1;
    const pageSize = 30;

    const { db, openai } = getDeps();

    const issues = await SemanticSearch.getIssues(
      {
        query,
        rateLimiter: c.env.RATE_LIMITER,
        mode: "me",
      },
      db,
      openai,
    );
    const totalResults = issues.length;
    // infer type from data in future
    return c.json(
      createPaginatedResponse(
        issues,
        pageNumber,
        Math.ceil(totalResults / pageSize),
        "Search results",
      ),
      200,
    );
  },
);
