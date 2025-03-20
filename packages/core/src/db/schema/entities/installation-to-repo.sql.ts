import {
  bigint,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

import { sql } from "@/db";

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
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull(),
    repoNodeId: text("repo_node_id").notNull(), // good to have, but not used at the moment
    repoId: text("repo_id").references(() => repos.id),
    metadata: jsonb("metadata").$type<RepoMetadata>(),
    addedAt: timestamptz("added_at").notNull(),
    removedAt: timestamptz("removed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.installationId, table.githubRepoId] }),
    // For finding all accessible repos for an installation
    index("installations_to_repos_installation_idx").on(table.installationId),
    // For finding which installations can access a repo
    index("installations_to_repos_repo_idx").on(table.repoId),
    // For finding repos that need to be created in repos table
    index("installations_to_repos_repo_node_idx").on(table.repoNodeId),
    // Partial index for active installations (not removed)
    index("installations_to_repos_active_idx")
      .on(table.installationId)
      .where(sql`${table.removedAt} IS NULL`),
  ],
);
