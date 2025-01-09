import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { searchIssues } from "@/core/semsearch";
import { Resource } from "@/bindings";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { getJson, putJson } from "@/server/kv";
import { createPaginatedResponse } from "@/server/response";
import { publicSearchSchema } from "@/server/router/schema/search.schema";

type CachedSearchResult = Awaited<ReturnType<typeof searchIssues>>;

export const searchRouter = new Hono<Context>().get(
  "/",
  zValidator("query", publicSearchSchema),
  async (c) => {
    const { q: query, page, lucky } = c.req.valid("query");
    const pageNumber = page ?? 1;
    const pageSize = 30;
    const { db, openai } = getDeps();

    let issues: CachedSearchResult["data"];
    let totalCount: CachedSearchResult["totalCount"];

    // Don't use cache for "lucky" searches
    if (!lucky) {
      const cacheKey = `public:search:q=${query}:page=${pageNumber}:size=${pageSize}`;
      const cached = await getJson<CachedSearchResult>(
        Resource.SearchCacheKv,
        cacheKey,
      );
      if (cached) {
        issues = cached.data;
        totalCount = cached.totalCount;
      } else {
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
        issues = results.data;
        totalCount = results.totalCount;

        // Cache the search results
        await putJson(
          Resource.SearchCacheKv,
          cacheKey,
          { data: issues, totalCount },
          { expirationTtl: 600 }, // 10 minutes
        );
      }
    } else {
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
      issues = results.data;
      totalCount = results.totalCount;
    }

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
