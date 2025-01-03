import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { searchIssues } from "@/core/semsearch";
import { getDeps } from "@/deps";
import type { AuthedContext } from "@/server/app";
import { createPaginatedResponse } from "@/server/response";
import { meSearchSchema } from "@/server/router/schema/search.schema";

export const searchRouter = new Hono<AuthedContext>().get(
  "/",
  zValidator("query", meSearchSchema),
  async (c) => {
    const { q: query, page } = c.req.valid("query");
    const pageNumber = page ?? 1;
    const pageSize = 30;

    const { db, openai } = getDeps();
    const user = c.get("user");
    const { data: issues, totalCount } = await searchIssues(
      {
        query,
        mode: "me",
        userId: user.id,
        page: pageNumber,
        pageSize,
      },
      db,
      openai,
      c.env.RATE_LIMITER,
    );

    return c.json(
      createPaginatedResponse(
        issues,
        pageNumber,
        Math.ceil(totalCount / pageSize),
        "Search results",
      ),
      200,
    );
  },
);
