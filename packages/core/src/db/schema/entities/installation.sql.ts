import { index, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

import { getBaseColumns, timestamptz } from "../base.sql";
import { users } from "./user.sql";

export const targetTypeEnum = pgEnum("target_type", ["user", "organization"]);
export const repositorySelectionEnum = pgEnum("repository_selection", [
  "all",
  "selected",
]);

export const installations = pgTable(
  "installations",
  {
    ...getBaseColumns("installations"),
    githubInstallationId: text("github_installation_id").notNull().unique(),
    targetType: targetTypeEnum("target_type").notNull(),
    // References users.id when targetType is "user"
    // References organizations.id when targetType is "organization"
    // We can't use a proper foreign key because it could reference either table
    targetId: text("target_id").notNull(),
    repositorySelection: repositorySelectionEnum(
      "repository_selection",
    ).notNull(),
    installedByUserId: text("installed_by_user_id")
      .notNull()
      .references(() => users.id),
    installedAt: timestamptz("installed_at").notNull(),
    uninstalledAt: timestamptz("uninstalled_at"),
    // Installation token fields - expires after 1 hour
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
  },
  (table) => ({
    // Index for looking up installations by target (user/org)
    targetIdx: index("installations_target_idx").on(
      table.targetType,
      table.targetId,
    ),
    // Index for looking up installations by installer
    installedByUserIdx: index("installations_installed_by_user_idx").on(
      table.installedByUserId,
    ),
  }),
);
