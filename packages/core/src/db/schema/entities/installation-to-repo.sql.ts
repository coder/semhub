import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

import { getTimestampColumns, timestamptz } from "../base.sql";
import { installations } from "./installation.sql";
import { repos } from "./repo.sql";

export type RepoMetadata = {
  name: string;
  fullName: string;
  private: boolean;
};

export const installationsToRepos = pgTable(
  "installations_to_repos",
  {
    ...getTimestampColumns(),
    installationId: text("installation_id")
      .notNull()
      .references(() => installations.id),
    repoId: text("repo_id").references(() => repos.id),
    githubRepoId: integer("github_repo_id").notNull(),
    repoNodeId: text("repo_node_id").notNull(),
    metadata: jsonb("metadata").$type<RepoMetadata>(),
    addedAt: timestamptz("added_at").notNull(),
    removedAt: timestamptz("removed_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.installationId, table.repoNodeId] }),
    // For finding all accessible repos for an installation
    installationIdx: index("installations_to_repos_installation_idx").on(
      table.installationId,
    ),
    // For finding which installations can access a repo
    repoIdx: index("installations_to_repos_repo_idx").on(table.repoId),
    // For finding repos that need to be created in repos table
    repoNodeIdx: index("installations_to_repos_repo_node_idx").on(
      table.repoNodeId,
    ),
    // Partial index for active installations (not removed)
    activeInstallationIdx: index("installations_to_repos_active_idx")
      .on(table.installationId)
      .where(sql`${table.removedAt} IS NULL`),
  }),
);
