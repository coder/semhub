import { text, timestamp } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

// whenever a new table is added, we need to update this function
// else it will default to the full table name, which is fine too actually
function mapTableNameToPrefix(tableName: string) {
  switch (tableName) {
    case "repos":
      return "rep";
    case "issues":
      return "iss";
    default:
      return tableName;
  }
}

const getIdColumn = (tableName: string) =>
  text("id")
    .primaryKey()
    .$defaultFn(() => `${mapTableNameToPrefix(tableName)}_${ulid()}`);

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const getBaseColumns = (tableName: string) => ({
  id: getIdColumn(tableName),
  ...timestamps,
});
