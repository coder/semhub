import { and, eq, isNull, or, sql } from "drizzle-orm";

import type { DbClient } from "@/db";
import { installationsToRepos } from "@/db/schema/entities/installation-to-repo.sql";
import {
  installations,
  type InstallationPermissions,
} from "@/db/schema/entities/installation.sql";
import { organizations } from "@/db/schema/entities/organization.sql";
import { users } from "@/db/schema/entities/user.sql";

import type { AppAuth } from "./github/shared";

export namespace Installation {
  export function mapGithubTargetType(githubType: "Organization" | "User") {
    switch (githubType) {
      case "Organization":
        return "organization" as const;
      case "User":
        return "user" as const;
      default:
        githubType satisfies never;
        throw new Error(`Unexpected GitHub target type: ${githubType}`);
    }
  }

  export async function getTargetId({
    targetType,
    nodeId,
    db,
  }: {
    targetType: "Organization" | "User";
    nodeId: string;
    db: DbClient;
  }) {
    switch (targetType) {
      case "Organization": {
        const [org] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.nodeId, nodeId));
        return org?.id ?? null;
      }
      case "User": {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.nodeId, nodeId));
        return user?.id ?? null;
      }
      default:
        targetType satisfies never;
        throw new Error(`Not supported target type: ${targetType}`);
    }
  }

  export async function getInstallerUserId({
    nodeId,
    installerType,
    db,
  }: {
    nodeId: string;
    installerType: "User" | "Organization" | "Bot";
    db: DbClient;
  }) {
    switch (installerType) {
      case "User": {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.nodeId, nodeId));
        return user?.id ?? null;
      }
      case "Bot":
      case "Organization": {
        throw new Error(`Not supported installer type: ${installerType}`);
      }
      default:
        installerType satisfies never;
        throw new Error(`Unexpected installer type: ${installerType}`);
    }
  }

  export async function hasValidInstallation({
    userId,
    requiredPermissions,
    db,
  }: {
    userId: string;
    requiredPermissions: InstallationPermissions;
    db: DbClient;
  }): Promise<boolean> {
    // Build permission checks for the SQL query
    const permissionChecks = Object.entries(requiredPermissions).map(
      ([scope, requiredLevel]) => {
        const validLevels = (() => {
          switch (requiredLevel) {
            case "read":
              return ["read", "write", "admin"];
            case "write":
              return ["write", "admin"];
            case "admin":
              return ["admin"];
            default:
              return [];
          }
        })();
        return and(
          sql`${installations.permissions}->>${sql.raw(scope)} IS NOT NULL`,
          sql`${installations.permissions}->>${sql.raw(scope)} = ANY(${validLevels})`,
        );
      },
    );

    // Find any installation that has required permissions and at least one accessible repo
    const [validInstallation] = await db
      .select({
        id: installations.id,
      })
      .from(installations)
      .innerJoin(
        installationsToRepos,
        and(
          eq(installations.id, installationsToRepos.installationId),
          isNull(installationsToRepos.removedAt),
        ),
      )
      .where(
        and(
          // Installation is not uninstalled
          isNull(installations.uninstalledAt),
          // Installation is not suspended
          isNull(installations.suspendedAt),
          or(
            // User has directly installed the app
            and(
              eq(installations.targetType, "user"),
              eq(installations.targetId, userId),
            ),
            // Or user installed it for their org
            eq(installations.installedByUserId, userId),
          ),
          ...permissionChecks,
        ),
      )
      .limit(1);

    return !!validInstallation;
  }

  export async function getInstallationAccessToken({
    installationId,
    db,
    appAuthOctokit,
  }: {
    installationId: string;
    db: DbClient;
    appAuthOctokit: AppAuth;
  }) {
    const [installation] = await db
      .select({
        accessToken: installations.accessToken,
        accessTokenExpiresAt: installations.accessTokenExpiresAt,
      })
      .from(installations)
      .where(eq(installations.id, installationId));

    if (
      !installation?.accessToken ||
      (installation.accessTokenExpiresAt &&
        installation.accessTokenExpiresAt < new Date())
    ) {
      const { token, expiresAt } = await appAuthOctokit({
        type: "app",
      });

      await db
        .update(installations)
        .set({
          accessToken: token,
          accessTokenExpiresAt: new Date(expiresAt),
        })
        .where(eq(installations.id, installationId));

      return token;
    }
    return installation.accessToken;
  }
}
