import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns } from "../base.sql";

export const users = pgTable("users", {
  ...getBaseColumns("users"),
  email: text("email").notNull().unique(),
});
