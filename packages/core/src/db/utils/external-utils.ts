// copied from https://gist.github.com/rphlmr/0d1722a794ed5a16da0fdf6652902b15 with modifications
import {
  and,
  is,
  sql,
  type AnyColumn,
  type GetColumnData,
  type SQL,
} from "drizzle-orm";
import { PgTimestampString, type SelectedFields } from "drizzle-orm/pg-core";
import { type SelectResultFields } from "drizzle-orm/query-builders/select.types";

import { coalesce } from "./general";

// demo https://drizzle.run/se2noay5mhdu24va3xhv0lqo

export function jsonBuildObject<T extends SelectedFields>(shape: T) {
  const chunks: SQL[] = [];

  Object.entries(shape).forEach(([key, value]) => {
    if (chunks.length > 0) {
      chunks.push(sql.raw(`,`));
    }

    chunks.push(sql.raw(`'${key}',`));

    // json_build_object formats to ISO 8601 ...
    if (is(value, PgTimestampString)) {
      chunks.push(sql`timezone('UTC', ${value})`);
    } else {
      chunks.push(sql`${value}`);
    }
  });

  return sql<SelectResultFields<T>>`json_build_object(${sql.join(chunks)})`;
}

export function jsonAggBuildObject<
  T extends SelectedFields,
  Column extends AnyColumn,
>(
  shape: T,
  options?: { orderBy?: { colName: Column; direction: "ASC" | "DESC" } },
) {
  return sql<SelectResultFields<T>[]>`coalesce(
    json_agg(${jsonBuildObject(shape)}
    ${
      options?.orderBy
        ? sql`ORDER BY ${options.orderBy.colName} ${sql.raw(
            options.orderBy.direction,
          )}`
        : undefined
    })
    FILTER (WHERE ${and(
      sql.join(
        Object.values(shape).map((value) => sql`${sql`${value}`} IS NOT NULL`),
        sql` AND `,
      ),
    )})
    ,'${sql`[]`}')`;
}

// with filter non-null + distinct
export function jsonAgg<Column extends AnyColumn>(column: Column) {
  return coalesce<GetColumnData<Column, "raw">[]>(
    sql`json_agg(distinct ${sql`${column}`}) filter (where ${column} is not null)`,
    sql`'[]'`,
  );
}

// // generalist
// export function jsonAgg<Column extends AnyColumn>(column: Column) {
//   return coalesce<GetColumnData<Column, "raw">[]>(
//     sql`json_agg(${sql`${column}`})`,
//     sql`'[]'`
//   );
// }

// Sometimes you want an array and not a json
export function arrayAgg<Column extends AnyColumn>(column: Column) {
  return sql<
    GetColumnData<Column, "raw">[]
  >`array_agg(distinct ${sql`${column}`}) filter (where ${column} is not null)`;
}

// To be completed
type PGCastTypes = "uuid" | "uuid[]" | "text" | "text[]";

type PGArrayCastTypes = {
  [P in PGCastTypes]: P extends `${infer _T}[]` ? P : never;
}[PGCastTypes];

// Transform an array of values (from a function params) into a postgres array
export function toArray<Values>(values: Values[], cast: PGArrayCastTypes) {
  const chunks: SQL[] = [];

  values.forEach((column) => {
    if (chunks.length > 0) {
      chunks.push(sql.raw(`,`));
    }

    chunks.push(sql`${column}`);
  });

  return sql`array[${sql.join(chunks)}]::${sql.raw(cast)}`;
}

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
