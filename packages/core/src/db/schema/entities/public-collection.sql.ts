import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns } from "../base.sql";

export const publicCollections = pgTable("public_collections", {
  ...getBaseColumns("public_collections"),
  name: text("name").notNull().unique(),
  description: text("description"),
});
