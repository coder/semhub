import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { Resource } from "sst";

import { searchIssues, searchResultSchema } from "@/core/semsearch";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { getJson, putJson } from "@/server/kv";
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
      const results = await searchIssues(
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

    // Use cache
    const cacheKey = `public:search:q=${query}:page=${pageNumber}:size=${pageSize}`;
    const cached = await getJson(Resource.SearchCacheKv, cacheKey);

    if (cached !== null) {
      // Validate cached data against schema
      const res = searchResultSchema.safeParse(cached);
      if (res.success) {
        const { data, totalCount } = res.data;
        return c.json(
          createPaginatedResponse({
            data,
            page: pageNumber,
            totalPages: Math.ceil(totalCount / pageSize),
            message: "Search successful",
          }),
          200,
        );
      } else {
        // invalidate cache
        await Resource.SearchCacheKv.delete(cacheKey);
      }
    }

    // if not cached or validation fails, perform new search
    const results = await searchIssues(
      {
        query,
        mode: "public",
        lucky: false,
        page: pageNumber,
        pageSize,
      },
      db,
      openai,
    );

    await putJson(
      Resource.SearchCacheKv,
      cacheKey,
      results,
      // 10 minutes because issues are synced every 20 minutes (SYNC_ISSUE: "*/20 * * * *")
      // so on average, a cached result will be at most 10 minutes stale
      { expirationTtl: 600 },
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
  },
);
