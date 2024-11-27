import type { AnyColumn, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function lower(column: AnyColumn | SQL): SQL {
  return sql`lower(${column})`;
}

export function takeFirst<T>(items: T[]) {
  return items.at(0);
}

export function takeFirstOrThrow<T>(items: T[]) {
  const first = takeFirst(items);

  if (!first) {
    throw new Error("First item not found");
  }

  return first;
}

export function distinct<Column extends AnyColumn>(column: Column) {
  return sql<Column["_"]["data"]>`distinct(${column})`;
}

export function distinctOn<Column extends AnyColumn>(column: Column) {
  return sql<Column["_"]["data"]>`distinct on (${column}) ${column}`;
}

export function max<Column extends AnyColumn>(column: Column) {
  return sql<Column["_"]["data"]>`max(${column})`;
}

export function count<Column extends AnyColumn>(column: Column) {
  return sql<number>`cast(count(${column}) as integer)`;
}

/**
 * Coalesce a value to a default value if the value is null
 * Ex default array: themes: coalesce(pubThemeListQuery.themes, sql`'[]'`)
 * Ex default number: votesCount: coalesce(PubPollAnswersQuery.count, sql`0`)
 */
export function coalesce<T>(value: SQL.Aliased<T> | SQL<T>, defaultValue: SQL) {
  return sql<T>`coalesce(${value}, ${defaultValue})`;
}
