import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export function lower(column: AnyPgColumn | SQL): SQL {
  return sql`lower(${column})`;
}
