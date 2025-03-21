import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { routeSearch } from "@/core/semsearch/index";
import {
  searchResultSchema,
  type SearchResult,
} from "@/core/semsearch/schema.output";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { CacheKey, withCache } from "@/server/kv";
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

    // Early return for lucky searches
    if (lucky) {
      const results = await routeSearch(
        {
          query,
          mode: "public",
          lucky: true,
          page: pageNumber,
          pageSize,
        },
        db,
        openai,
      );
      return c.json(
        createPaginatedResponse({
          data: results.data,
          page: pageNumber,
          totalPages: Math.ceil(results.totalCount / pageSize),
          message: "Search successful",
        }),
        200,
      );
    }

    const result = await withCache<SearchResult>({
      key: CacheKey.publicSearch(query, pageNumber, pageSize),
      schema: searchResultSchema,
      options: { expirationTtl: 600 }, // 10 minutes because issues are synced every 20 minutes
      fetch: () =>
        routeSearch(
          {
            query,
            mode: "public",
            lucky: false,
            page: pageNumber,
            pageSize,
          },
          db,
          openai,
        ),
    });

    return c.json(
      createPaginatedResponse({
        data: result.data,
        page: pageNumber,
        totalPages: Math.ceil(result.totalCount / pageSize),
        message: "Search successful",
      }),
      200,
    );
  },
);
