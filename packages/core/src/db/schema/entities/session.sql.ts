import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";
import { users } from "./user.sql";

export const sessions = pgTable("sessions", {
  ...getBaseColumns("sessions"),
  expiresAt: timestamptz("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
});
