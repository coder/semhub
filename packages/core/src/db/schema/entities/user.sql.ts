import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns } from "../base.sql";

export const users = pgTable("users", {
  ...getBaseColumns("users"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url").notNull(),
});
