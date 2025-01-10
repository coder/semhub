import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { Resource } from "sst";

import type { SearchResult } from "@/core/semsearch";
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
    const startTime = performance.now();
    const { q: query, page, lucky } = c.req.valid("query");
    const pageNumber = page ?? 1;
    const pageSize = 30;
    const { db, openai } = getDeps();

    // Early return for lucky searches
    if (lucky) {
      const luckyStartTime = performance.now();
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
      console.log(
        `[PERF] Lucky search took ${performance.now() - luckyStartTime}ms`,
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
    // const cacheStartTime = performance.now();
    // const cacheKey = `public:search:q=${query}:page=${pageNumber}:size=${pageSize}`;
    // const cached = await getJson<SearchResult>(
    //   Resource.SearchCacheKv,
    //   cacheKey,
    // );
    // console.log(
    //   `[PERF] Cache lookup took ${performance.now() - cacheStartTime}ms`,
    // );

    // if (cached) {
    //   // Validate cached data against schema
    //   const res = searchResultSchema.safeParse(cached);
    //   if (res.success) {
    //     const { data, totalCount } = res.data;
    //     return c.json(
    //       createPaginatedResponse({
    //         data,
    //         page: pageNumber,
    //         totalPages: Math.ceil(totalCount / pageSize),
    //         message: "Search successful",
    //       }),
    //       200,
    //     );
    //   } else {
    //     // invalidate cache
    //     await Resource.SearchCacheKv.delete(cacheKey);
    //   }
    // }
    // if not cached or validation fails, perform new search
    const searchStartTime = performance.now();
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
    console.log(
      `[PERF] Search execution took ${performance.now() - searchStartTime}ms`,
    );

    // const cacheWriteStartTime = performance.now();
    // await putJson(
    //   Resource.SearchCacheKv,
    //   cacheKey,
    //   results,
    //   // 10 minutes because issues are synced every 20 minutes (SYNC_ISSUE: "*/20 * * * *")
    //   // so on average, a cached result will be at most 10 minutes stale
    //   { expirationTtl: 600 },
    // );
    // console.log(
    //   `[PERF] Cache write took ${performance.now() - cacheWriteStartTime}ms`,
    // );
    console.log(`[PERF] Total request took ${performance.now() - startTime}ms`);

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
