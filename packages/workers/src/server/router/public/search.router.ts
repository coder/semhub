import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { SemanticSearch } from "@/core/semsearch";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { createPaginatedResponse } from "@/server/response";
import { publicSearchSchema } from "@/server/router/schema/search.schema";

export const searchRouter = new Hono<Context>().get(
  "/",
  zValidator("query", publicSearchSchema),
  async (c) => {
    const { q: query, page, lucky } = c.req.valid("query");
    const pageNumber = page ?? 1;
    const pageSize = 30;

    const { db, openai } = getDeps();

    const { data: issues, totalCount } = await SemanticSearch.getIssues(
      {
        query,
        mode: "public",
        lucky: lucky === "y",
        page: pageNumber,
        pageSize,
      },
      db,
      openai,
      c.env.RATE_LIMITER,
    );
    // unsure why, redirect doesn't work, redirect on client instead
    // if (lucky === "y" && issues[0]) {
    //   const { issueUrl } = issues[0];
    //   return c.redirect(issueUrl);
    // }
    // infer type from data in future
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
