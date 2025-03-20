import type { SQL, Table } from "drizzle-orm";
import { getTableColumns, sql } from "drizzle-orm";

// from https://github.com/drizzle-team/drizzle-orm/issues/1728
export function conflictUpdateAllExcept<
  T extends Table,
  E extends (keyof T["$inferInsert"])[],
>(table: T, except: E) {
  const columns = getTableColumns(table);
  const updateColumns = Object.entries(columns).filter(
    ([col]) => !except.includes(col as keyof typeof table.$inferInsert),
  );

  return updateColumns.reduce(
    (acc, [colName, table]) => ({
      ...acc,
      [colName]: sql.raw(`excluded.${table.name}`),
    }),
    {},
  ) as Omit<Record<keyof typeof table.$inferInsert, SQL>, E[number]>;
}

export function conflictUpdateOnly<
  T extends Table,
  I extends (keyof T["$inferInsert"])[],
>(table: T, include: I) {
  const columns = getTableColumns(table);
  const updateColumns = Object.entries(columns).filter(([col]) =>
    include.includes(col as keyof typeof table.$inferInsert),
  );

  return updateColumns.reduce(
    (acc, [colName, table]) => ({
      ...acc,
      [colName]: sql.raw(`excluded.${table.name}`),
    }),
    {},
  ) as Pick<
    Record<keyof typeof table.$inferInsert, SQL>,
    I[number] & (string | number)
  >;
}
