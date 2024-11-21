import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { type PgColumn } from "drizzle-orm/pg-core";

export function lower(column: AnyPgColumn | SQL): SQL {
  return sql`lower(${column})`;
}

// Type to get nested path types
export type PathsToStringProperty<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string
        ? K
        : T[K] extends object
          ? `${K & string}.${PathsToStringProperty<T[K]>}`
          : never;
    }[keyof T & string]
  : never;

// Helper type to extract the data type from a PgColumn
export type ExtractColumnData<T> =
  T extends PgColumn<infer Config, any, any>
    ? Config extends { data: any }
      ? Config["data"]
      : never
    : never;

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
