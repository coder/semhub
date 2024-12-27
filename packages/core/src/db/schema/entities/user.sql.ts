import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { type GithubScope } from "@/github/permission/oauth";

import { getBaseColumns, timestamptz } from "../base.sql";

export type GithubScopes = Array<GithubScope>;

export type UserMetadata = {
  company: string | null;
  location: string | null;
  bio: string | null;
  emails: string[];
};

export const users = pgTable("users", {
  ...getBaseColumns("users"),
  nodeId: text("node_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  email: text("email").notNull(), // not unique because users can change their emails. we track the underlying Github user using nodeId
  avatarUrl: text("avatar_url"),
  htmlUrl: text("html_url").notNull(),
  githubScopes: jsonb("github_scopes").$type<GithubScopes>(),
  authRevokedAt: timestamptz("auth_revoked_at"),
  accessToken: text("access_token").notNull(),
  metadata: jsonb("metadata").$type<UserMetadata>(),
});
