import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { getBaseColumns, timestamptz } from "../base.sql";

export const initStatusEnum = pgEnum("init_status", [
  "pending", // for private repos that were added via GitHub App, before user has actively subscribed
  "ready",
  "in_progress",
  "completed",
  "error",
  "no_issues",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "ready", // only pick up repos that are ready + initStatus is completed
  "queued",
  "in_progress",
  "error",
]);

const _syncCursorSchema = z.object({
  since: z.string().datetime(), // cannot store date in db, so we store string
  after: z.string().nullable(),
});
export type SyncCursor = z.infer<typeof _syncCursorSchema>;
export const convertSyncCursor = (cursor: SyncCursor | null) => {
  if (!cursor) {
    return null;
  }
  return {
    since: new Date(cursor.since),
    after: cursor.after,
  };
};

export const repos = pgTable(
  "repos",
  {
    ...getBaseColumns("repos"),
    // at some point, could normalise into its own table?
    ownerLogin: text("owner_login").notNull(),
    ownerAvatarUrl: text("owner_avatar_url").notNull(),
    name: text("name").notNull(),
    nodeId: text("node_id").notNull().unique(),
    htmlUrl: text("html_url").notNull(),
    isPrivate: boolean("is_private").notNull(),
    syncStatus: syncStatusEnum("sync_status").notNull().default("ready"),
    lastSyncedAt: timestamptz("last_synced_at"),
    initStatus: initStatusEnum("init_status").notNull().default("ready"),
    initializedAt: timestamptz("initialized_at"),
    syncCursor: jsonb("sync_cursor").$type<SyncCursor>(),
    // NB based on setIssuesLastUpdatedAt, we only consider issues with embeddings in this col
    // this is because we display this on the frontend and issues without embeddings are not searchable
    // this means we may be upserting extra issues during sync, but that's ok
  },
  (table) => [
    // probably could be unique index, but small chance that org / repo names can change
    index("owner_name_idx").on(table.ownerLogin, table.name),
    index("owner_idx").on(table.ownerLogin),
    index("created_at_idx").on(table.createdAt),
    index("repo_sync_idx").on(
      table.initStatus,
      table.syncStatus,
      table.lastSyncedAt.asc().nullsFirst(),
    ),
    index("repo_init_idx").on(table.initStatus, table.createdAt.asc()),
  ],
);
