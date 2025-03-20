import { relations } from "drizzle-orm";
import { pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";

import { getTimestampColumns } from "../base.sql";
import { publicCollections } from "./public-collection.sql";
import { repos } from "./repo.sql";

export const publicCollectionsToRepos = pgTable(
  "public_collections_to_repos",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => publicCollections.id, {
        onDelete: "cascade",
      }),
    repoId: text("repo_id")
      .notNull()
      .references(() => repos.id, {
        onDelete: "cascade",
      }),
    ...getTimestampColumns(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.repoId] }),
    unique().on(t.repoId, t.collectionId),
  ],
);

export const publicCollectionToReposRelations = relations(
  publicCollectionsToRepos,
  ({ one }) => ({
    collection: one(publicCollections, {
      fields: [publicCollectionsToRepos.collectionId],
      references: [publicCollections.id],
    }),
    repo: one(repos, {
      fields: [publicCollectionsToRepos.repoId],
      references: [repos.id],
    }),
  }),
);
