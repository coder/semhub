import { sql } from "drizzle-orm";
import { index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { getTimestampColumns, timestamptz } from "../base.sql";
import { installations } from "./installation.sql";
import { repos } from "./repo.sql";

export const installationsToRepos = pgTable(
  "installations_to_repos",
  {
    ...getTimestampColumns(),
    installationId: text("installation_id")
      .notNull()
      .references(() => installations.id),
    repoId: text("repo_id")
      .notNull()
      .references(() => repos.id),
    addedAt: timestamptz("added_at").notNull(),
    removedAt: timestamptz("removed_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.installationId, table.repoId] }),
    // For finding all accessible repos for an installation
    installationIdx: index("installations_to_repos_installation_idx").on(
      table.installationId,
    ),
    // For finding which installations can access a repo
    repoIdx: index("installations_to_repos_repo_idx").on(table.repoId),
    // Partial index for active installations (not removed)
    activeInstallationIdx: index("installations_to_repos_active_idx")
      .on(table.installationId)
      .where(sql`${table.removedAt} IS NULL`),
  }),
);
