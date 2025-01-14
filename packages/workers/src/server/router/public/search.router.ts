import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { Resource } from "sst";

import { routeSearch } from "@/core/semsearch/index";
import { searchResultSchema, type SearchResult } from "@/core/semsearch/schema";
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
        {
          lambdaUrl: Resource.Search.url,
          lambdaInvokeSecret: Resource.Keys.lambdaInvokeSecret,
        },
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
    const cachedData = await getJson<SearchResult>(
      Resource.SearchCacheKv,
      cacheKey,
      searchResultSchema,
    );

    if (cachedData) {
      const { data, totalCount } = cachedData;
      return c.json(
        createPaginatedResponse({
          data,
          page: pageNumber,
          totalPages: Math.ceil(totalCount / pageSize),
          message: "Search successful",
        }),
        200,
      );
    }
    const results = await routeSearch(
      {
        query,
        mode: "public",
        lucky: false,
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

    await putJson<SearchResult>(
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
