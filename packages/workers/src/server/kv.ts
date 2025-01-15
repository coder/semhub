import type { z } from "zod";

import { restoreTypes } from "@/core/util/json";

/**
 * Generic KV utilities for JSON data
 */
// this ensures type argument is passed, use in conjunction with getJson
export async function getJson<T = void, U extends T = T>(
  kv: KVNamespace,
  key: string,
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

export async function putJson<T = void, U extends T = T>(
  kv: KVNamespace,
  key: string,
  value: U,
  options?: KVNamespacePutOptions,
): Promise<void> {
  if (typeof value !== "object") {
    throw new Error("value is not an object, it is a " + typeof value);
  }
  await kv.put(key, JSON.stringify(value), options);
}
