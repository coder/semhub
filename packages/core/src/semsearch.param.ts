import { sql } from "drizzle-orm";

export const HNSW_ISSUE_COUNT_THRESHOLD = 25000;

export const VECTOR_SIMILARITY_SEARCH_LIMIT = 1000;

export const HNSW_EF_SEARCH = 1000;
export const HNSW_MAX_SCAN_TUPLES = 20000;
export const HNSW_SCAN_MEM_MULTIPLIER = 2;

export function convertToSqlRaw(value: number | string) {
  return sql.raw(value.toString());
}
