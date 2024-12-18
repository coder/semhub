import { sql } from "drizzle-orm";
import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";

export type GithubScopes = string[];

export type UserMetadata = {
  company: string | null;
  location: string | null;
  bio: string | null;
};

export const users = pgTable("users", {
  ...getBaseColumns("users"),
  nodeId: text("node_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  htmlUrl: text("html_url").notNull(),
  githubScopes: jsonb("github_scopes").$type<GithubScopes>(),
  authRevokedAt: timestamptz("auth_revoked_at"),
  accessToken: text("access_token").notNull(),
  metadata: jsonb("metadata").$type<UserMetadata>(),
});
