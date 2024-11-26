import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyPgColumn, PgColumn } from "drizzle-orm/pg-core";

import type {
  ExtractColumnData,
  PathsToStringProperty,
  PathsToStringPropertyInArray,
} from "./utils.d";

export function lower(column: AnyPgColumn | SQL): SQL {
  return sql`lower(${column})`;
}

export function jsonExtract<
  TColumn extends PgColumn<any, any, any>,
  // non-nullable added to deal with JSONB columns that can be null
  TPath extends PathsToStringProperty<NonNullable<ExtractColumnData<TColumn>>>,
>(column: TColumn, path: TPath) {
  const parts = path.split(".");
  const lastPart = parts.pop()!;
  const pathParts = parts.length
    ? parts.map((p) => `'${p}'`).join("->") + `->'${lastPart}'`
    : `'${lastPart}'`;
  return sql`${column}->>${sql.raw(pathParts)}`;
}

// jsonArraySome checks if there's ANY element in the array where the specified field exists and is not null:
export function jsonArraySome<
  TColumn extends PgColumn<any, any, any>,
  TPath extends PathsToStringPropertyInArray<
    NonNullable<ExtractColumnData<TColumn>>
  >,
>(column: TColumn, path: TPath) {
  const parts = path.split(".");
  const lastPart = parts.pop()!;
  const pathParts = parts.length
    ? parts.map((p) => `'${p}'`).join("->") + `->'${lastPart}'`
    : `'${lastPart}'`;
  return sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements(${column}) as elem
    WHERE elem->>${sql.raw(pathParts)} IS NOT NULL
  )`;
}

// checks if there's ANY element in the array where the specified field EQUALS a specific value:
export function jsonArrayContains<
  TColumn extends PgColumn<any, any, any>,
  TPath extends PathsToStringPropertyInArray<
    NonNullable<ExtractColumnData<TColumn>>
  >,
>(column: TColumn, path: TPath, value: string) {
  const parts = path.split(".");
  const lastPart = parts.pop()!;
  const pathParts = parts.length
    ? parts.map((p) => `'${p}'`).join("->") + `->'${lastPart}'`
    : `'${lastPart}'`;
  return sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements(${column}) as elem
    WHERE elem->>${sql.raw(pathParts)} = ${value}
  )`;
}
