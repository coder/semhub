import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";

export const verifications = pgTable("verifications", {
  ...getBaseColumns("verifications"),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamptz("expiresAt").notNull(),
});
