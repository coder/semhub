import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { getBaseColumns } from "../base.sql";

export const repos = pgTable(
  "repos",
  {
    ...getBaseColumns("repos"),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    nodeId: text("node_id").notNull().unique(),
    htmlUrl: text("html_url").notNull(),
    isPrivate: boolean("is_private").notNull(),
    issuesLastUpdatedAt: timestamp("issues_last_updated_at"), // if null, it means issues have not been loaded for this repo yet
  },
  (table) => ({
    // probably could be unique index, but small chance that org / repo names can change
    ownerNameIdx: index("owner_name_idx").on(table.owner, table.name),
  }),
);

export const createRepoSchema = createInsertSchema(repos, {
  htmlUrl: z.string().url(),
}).omit({
  id: true,
});
