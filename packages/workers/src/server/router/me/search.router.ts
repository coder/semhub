import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { Resource } from "sst";

import { routeSearch } from "@/core/semsearch";
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
    const { data: issues, totalCount } = await routeSearch(
      {
        query,
        mode: "me",
        userId: user.id,
        page: pageNumber,
        pageSize,
      },
      db,
      openai,
      {
        lambdaUrl: Resource.Search.url,
        lambdaInvokeSecret: Resource.Keys.lambdaInvokeSecret,
      },
    );

    return c.json(
      createPaginatedResponse({
        data: issues,
        page: pageNumber,
        totalPages: Math.ceil(totalCount / pageSize),
        message: "Search successful",
      }),
      200,
    );
  },
);
