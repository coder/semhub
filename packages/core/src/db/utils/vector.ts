import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";
import type { TypedQueryBuilder } from "drizzle-orm/query-builders/query-builder";
import type { SQLWrapper } from "drizzle-orm/sql";

function toSql(value: number[] | string[]): string {
  return JSON.stringify(value);
}

// copy from drizzle-orm/sql/functions/vector.ts
// BUT accept a type argument for type-safety
export function cosineDistance<T = unknown>(
  column: SQLWrapper | AnyColumn,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: number[] | string[] | TypedQueryBuilder<any> | string,
): SQL<T> {
  if (Array.isArray(value)) {
    return sql`${column} <=> ${toSql(value)}`;
  }
  return sql`${column} <=> ${value}`;
}
