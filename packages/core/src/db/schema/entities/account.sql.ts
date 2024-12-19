import { pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";
import { users } from "./user.sql";

export const accounts = pgTable("accounts", {
  ...getBaseColumns("accounts"),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamptz("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamptz("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
});
