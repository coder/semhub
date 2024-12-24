import { relations } from "drizzle-orm";
import { pgEnum, pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";

import { getTimestampColumns, timestamptz } from "../base.sql";
import { repos } from "./repo.sql";
import { users } from "./user.sql";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "inactive",
]);

export const usersToRepos = pgTable(
  "users_to_repos",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    repoId: text("repo_id")
      .notNull()
      .references(() => repos.id, {
        onDelete: "cascade",
      }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    subscribedAt: timestamptz("subscribed_at").notNull().defaultNow(),
    unsubscribedAt: timestamptz("unsubscribed_at"),
    ...getTimestampColumns(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.repoId] }),
    // big brain reverse unique index, see https://stackoverflow.com/a/60248297
    reversePk: unique().on(t.repoId, t.userId),
  }),
);

export const usersToReposRelations = relations(usersToRepos, ({ one }) => ({
  user: one(users, {
    fields: [usersToRepos.userId],
    references: [users.id],
  }),
  repo: one(repos, {
    fields: [usersToRepos.repoId],
    references: [repos.id],
  }),
}));
