import type { z } from "zod";

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
  const parsed = schema.safeParse(JSON.parse(value));
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

/**
 * Restores data types from JSON stringified data, particularly useful for dates
 * and numbers before running zod validation. Handles nested objects and arrays.
 * Preserves null values in nested objects.
 */
export function restoreTypes<T extends object>(data: T): T {
  if (!data || typeof data !== "object") return data;

  const restored = { ...data };
  for (const [key, value] of Object.entries(restored)) {
    if (value === null) {
      continue; // preserve null values
    } else if (typeof value === "string") {
      // Try to parse ISO date strings
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (dateRegex.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          (restored as any)[key] = date;
          continue;
        }
      }
      // Try to parse numbers
      const numberValue = Number(value);
      if (!isNaN(numberValue) && String(numberValue) === value) {
        (restored as any)[key] = numberValue;
      }
    } else if (Array.isArray(value)) {
      (restored as any)[key] = value.map((item) =>
        item === null
          ? null
          : typeof item === "object"
            ? restoreTypes(item)
            : item,
      );
    } else if (value && typeof value === "object") {
      (restored as any)[key] = restoreTypes(value);
    }
  }

  return restored;
}
