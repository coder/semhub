/**
 * Generic KV utilities for JSON data
 */
export async function getJson<T>(
  kv: KVNamespace,
  key: string,
): Promise<T | null> {
  const value = await kv.get(key);
  return value ? JSON.parse(value) : null;
}

export async function putJson<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options?: KVNamespacePutOptions,
): Promise<void> {
  if (typeof value !== "object") {
    throw new Error("value is not an object, it is a " + typeof value);
  }
  await kv.put(key, JSON.stringify(value), options);
}
