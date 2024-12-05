import { boolean, index, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { getBaseColumns, timestamptz } from "../base.sql";

export const repos = pgTable(
  "repos",
  {
    ...getBaseColumns("repos"),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    nodeId: text("node_id").notNull().unique(),
    htmlUrl: text("html_url").notNull(),
    isPrivate: boolean("is_private").notNull(),
    // boolean to orchestrate workflows
    isSyncing: boolean("is_syncing").notNull().default(false),
    lastSyncedAt: timestamptz("last_synced_at"),
    issuesLastUpdatedAt: timestamptz("issues_last_updated_at"), // null at first, then updated with last synced issue's updatedAt
  },
  (table) => ({
    // probably could be unique index, but small chance that org / repo names can change
    ownerNameIdx: index("owner_name_idx").on(table.owner, table.name),
    ownerIdx: index("owner_idx").on(table.owner),
  }),
);

export const createRepoSchema = createInsertSchema(repos, {
  htmlUrl: z.string().url(),
}).omit({
  id: true,
});
