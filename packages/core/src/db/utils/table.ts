import type { AnyColumn, AnyTable, TableConfig } from "drizzle-orm";

export type AnyTableWithColumns<T extends Partial<TableConfig<AnyColumn>>> =
  AnyTable<T> & {
    [Key in keyof T["columns"]]: T["columns"][Key];
  };
