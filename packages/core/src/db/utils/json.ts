import type { AnyColumn, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { type SelectedFields } from "drizzle-orm/pg-core";
import { type SelectResultFields } from "drizzle-orm/query-builders/select.types";

import { jsonBuildObject } from "./external-utils";
import type {
  ExtractColumnData,
  PathsToStringProperty,
  PathsToStringPropertyInArray,
} from "./json.d";

export function jsonContains<
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

// improvised somewhat, probably not the best way to do this
export function jsonAggBuildObjectFromJoin<
  T extends SelectedFields,
  Column extends AnyColumn,
>(
  shape: T,
  {
    from,
    joinTable,
    joinCondition,
    whereCondition,
    orderBy,
  }: {
    from: SQL;
    joinTable: SQL;
    joinCondition: SQL<unknown>;
    whereCondition?: SQL<unknown>;
    orderBy?: { colName: Column; direction: "ASC" | "DESC" };
  },
) {
  return sql<SelectResultFields<T>[]>`
    COALESCE(
      (
        SELECT json_agg(${jsonBuildObject(shape)}
          ${
            orderBy
              ? sql`ORDER BY ${orderBy.colName} ${sql.raw(orderBy.direction)}`
              : sql``
          }
        )
        FROM ${from}
        JOIN ${joinTable} ON ${joinCondition}
        ${whereCondition ? sql`WHERE ${whereCondition}` : sql``}
      ),
      '[]'::json
    )`;
}
