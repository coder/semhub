import { Resource } from "sst";
import type { z } from "zod";

import { restoreTypes } from "@/core/util/json";

/**
 * Generic KV utilities for JSON data
 */

export const CacheKey = {
  // Repo related keys
  repoIssueCounts: (owner: string, repo: string) =>
    `repo:${owner}/${repo}:github-issue-counts` as const,
  repoSyncedIssues: (owner: string, repo: string) =>
    `repo:${owner}/${repo}:synced-issues-count` as const,

  // Search related keys
  publicSearch: (query: string, page: number, pageSize: number) =>
    `public:search:q=${query}:page=${page}:size=${pageSize}` as const,
};

/**
 * Generic cache helper that handles fetching, validation, and caching of data
 */
export async function withCache<T>({
  key,
  schema,
  fetch,
  options,
}: {
  key: ReturnType<(typeof CacheKey)[keyof typeof CacheKey]>;
  schema: z.ZodSchema<T>;
  fetch: () => Promise<T>;
  options?: KVNamespacePutOptions;
}): Promise<T> {
  let cached = await getJson<T>(Resource.CacheKv, key, schema);
  if (!cached) {
    cached = await fetch();
    await putJson<T>(Resource.CacheKv, key, cached, options);
  }
  return cached;
}

// this ensures type argument is passed, use in conjunction with getJson
async function getJson<T = void, U extends T = T>(
  kv: KVNamespace,
  key: ReturnType<(typeof CacheKey)[keyof typeof CacheKey]>,
  schema: z.ZodSchema<U>,
) {
  const value = await kv.get(key);
  if (!value) return null;
  const parsed = schema.safeParse(restoreTypes(JSON.parse(value)));
  if (!parsed.success) {
    await kv.delete(key);
    return null;
  }
  return parsed.data;
}

async function putJson<T = void, U extends T = T>(
  kv: KVNamespace,
  key: ReturnType<(typeof CacheKey)[keyof typeof CacheKey]>,
  value: U,
  options?: KVNamespacePutOptions,
): Promise<void> {
  if (typeof value !== "object") {
    throw new Error("value is not an object, it is a " + typeof value);
  }
  await kv.put(key, JSON.stringify(value), options);
}
