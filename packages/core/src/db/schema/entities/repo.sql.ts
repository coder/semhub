import { boolean, index, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { getBaseColumns, timestamptz } from "../base.sql";

export const initStatusEnum = pgEnum("init_status", [
  "ready",
  "in_progress",
  "completed",
  "error",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "ready", // only pick up repos that are ready + initStatus is completed
  "queued",
  "in_progress",
  "error",
]);

export const repos = pgTable(
  "repos",
  {
    ...getBaseColumns("repos"),
    ownerLogin: text("owner_login").notNull(),
    ownerAvatarUrl: text("owner_avatar_url"),
    name: text("name").notNull(),
    nodeId: text("node_id").notNull().unique(),
    htmlUrl: text("html_url").notNull(),
    isPrivate: boolean("is_private").notNull(),
    syncStatus: syncStatusEnum("sync_status").notNull().default("ready"),
    lastSyncedAt: timestamptz("last_synced_at"),
    initStatus: initStatusEnum("init_status").notNull().default("ready"),
    initializedAt: timestamptz("initialized_at"),
    issuesLastEndCursor: text("issues_last_end_cursor"),
  },
  (table) => ({
    // probably could be unique index, but small chance that org / repo names can change
    ownerNameIdx: index("owner_name_idx").on(table.ownerLogin, table.name),
    ownerIdx: index("owner_idx").on(table.ownerLogin),
    createdAtIdx: index("created_at_idx").on(table.createdAt),
    repoSyncIdx: index("repo_sync_idx").on(
      table.initStatus,
      table.syncStatus,
      table.lastSyncedAt.asc().nullsFirst(),
    ),
    repoInitIdx: index("repo_init_idx").on(
      table.initStatus,
      table.createdAt.asc(),
    ),
  }),
);

export const createRepoSchema = createInsertSchema(repos, {
  htmlUrl: z.string().url(),
}).omit({
  id: true,
});
