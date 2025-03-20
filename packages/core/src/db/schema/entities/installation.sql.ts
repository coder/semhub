import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

import { sql } from "@/db";
import type { Permissions } from "@/github/schema.webhook";

import { getBaseColumns, timestamptz } from "../base.sql";
import { users } from "./user.sql";

export const targetTypeEnum = pgEnum("target_type", ["user", "organization"]);
export const repositorySelectionEnum = pgEnum("repository_selection", [
  "all",
  "selected",
]);

export type InstallationPermissions = Permissions;

export const installations = pgTable(
  "installations",
  {
    ...getBaseColumns("installations"),
    githubInstallationId: bigint("github_installation_id", { mode: "number" })
      .notNull()
      .unique(),
    targetType: targetTypeEnum("target_type").notNull(),
    // References users.id when targetType is "user"
    // References organizations.id when targetType is "organization"
    // We can't use a proper foreign key because it could reference either table
    targetId: text("target_id").notNull(),
    targetGithubId: bigint("target_github_id", { mode: "number" }).notNull(),
    targetNodeId: text("target_node_id").notNull(),
    repositorySelection: repositorySelectionEnum(
      "repository_selection",
    ).notNull(),
    installedByUserId: text("installed_by_user_id")
      .notNull()
      .references(() => users.id),
    installedAt: timestamptz("installed_at").notNull(),
    uninstalledAt: timestamptz("uninstalled_at"),
    // Suspension fields - can be suspended by GitHub (TOS/billing), org admin, or user
    suspendedAt: timestamptz("suspended_at"),
    suspendedBy: text("suspended_by"),
    // Permissions fields
    permissions: jsonb("permissions").$type<InstallationPermissions>(),
    permissionsUpdatedAt: timestamptz("permissions_updated_at"),
  },
  (table) => [
    // Index for looking up installations by target (user/org)
    index("installations_target_idx").on(table.targetType, table.targetId),
    // Index for looking up installations by installer
    index("installations_installed_by_user_idx").on(table.installedByUserId),
    // partial index for looking up active installations
    index("installations_active_idx")
      .on(table.uninstalledAt, table.suspendedAt)
      .where(
        sql`${table.uninstalledAt} IS NULL AND ${table.suspendedAt} IS NULL`,
      ),
  ],
);
