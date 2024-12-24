import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns } from "../base.sql";

export const organizations = pgTable("organizations", {
  // id column from getBaseColumns is referenced by installations.targetId
  // when installations.targetType is "organization"
  ...getBaseColumns("organizations"),
  nodeId: text("node_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  htmlUrl: text("html_url").notNull(),
});
