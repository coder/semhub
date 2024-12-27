import { and, eq, isNull, or, sql } from "drizzle-orm";
import { RequestError } from "octokit";

import type { DbClient } from "@/db";
import { installationsToRepos } from "@/db/schema/entities/installation-to-repo.sql";
import {
  installations,
  type InstallationPermissions,
} from "@/db/schema/entities/installation.sql";
import { organizations } from "@/db/schema/entities/organization.sql";
import { users } from "@/db/schema/entities/user.sql";

import { repos } from "./db/schema/entities/repo.sql";
import type { RestOctokit } from "./github/shared";

export namespace Installation {
  export async function getValidGithubInstallationIdByRepo({
    repoName,
    repoOwner,
    db,
    userId,
    restOctokitAppFactory,
  }: {
    db: DbClient;
    // if userId is null, it means we just get any valid one
    userId: string | null;
    repoName: string;
    repoOwner: string;
    restOctokitAppFactory: (installationId: number) => RestOctokit;
  }) {
    const [installation] = await db
      .select({
        repoId: repos.id,
        repoIsPrivate: repos.isPrivate,
        githubInstallationId: installations.githubInstallationId,
        installationTargetType: installations.targetType,
        installationTargetId: installations.targetId,
      })
      .from(repos)
      .innerJoin(
        installationsToRepos,
        eq(repos.id, installationsToRepos.repoId),
      )
      .innerJoin(
        installations,
        eq(installationsToRepos.installationId, installations.id),
      )
      .where(
        and(
          isNull(installations.uninstalledAt),
          isNull(installations.suspendedAt),
          isNull(installationsToRepos.removedAt),
          eq(repos.name, repoName),
          eq(repos.ownerLogin, repoOwner),
        ),
      )
      .limit(1);
    if (!installation) {
      return null;
    }
    if (!userId) {
      return installation;
    }
    // code path below is only if userId is provided and we're checking if the user has access to the repo
    const {
      installationTargetType,
      installationTargetId,
      githubInstallationId,
    } = installation;
    switch (installationTargetType) {
      case "user":
        // return null because repo belongs to another user
        return installationTargetId === userId ? installation : null;
      case "organization": {
        // check if user is a member of the org
        const octokit = restOctokitAppFactory(githubInstallationId);
        const [user] = await db
          .select({
            name: users.name,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!user) {
          throw new Error("User not found");
        }
        try {
          // overriding type is necessary because of Octokit bug
          // see https://github.com/octokit/rest.js/issues/188
          const { status }: { status: number } =
            await octokit.rest.orgs.checkMembershipForUser({
              org: installationTargetId,
              username: user.name,
            });

          // Only 204 means success, anything else means not a member
          return status === 204 ? installation : null;
        } catch (error) {
          if (error instanceof RequestError && error.status === 404) {
            // User is not a member of the organization
            return null;
          }
          throw error;
        }
      }
      default:
        installationTargetType satisfies never;
        throw new Error(
          `Unexpected installation target type: ${installationTargetType}`,
        );
    }
  }
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

  export async function userHasValidInstallation({
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
        return sql`(${installations.permissions}->${sql.raw(`'${scope}'`)} IS NOT NULL AND ${
          installations.permissions
        }->${sql.raw(`'${scope}'`)} IN (${sql.join(
          validLevels.map((level) => sql`to_jsonb(${level}::text)`),
          sql`, `,
        )}))`;
      },
    );

    const [validInstallation] = await db
      .select({
        id: installations.id,
      })
      .from(installations)
      // inner join to ensure we only get installations that have at least one accessible repo
      // can consider using exists in the future
      .innerJoin(
        installationsToRepos,
        eq(installations.id, installationsToRepos.installationId),
      )
      .where(
        and(
          isNull(installations.uninstalledAt),
          isNull(installations.suspendedAt),
          isNull(installationsToRepos.removedAt),
          or(
            // User has directly installed the app
            and(
              eq(installations.targetType, "user"),
              eq(installations.targetId, userId),
            ),
            // Or user installed it for their org
            eq(installations.installedByUserId, userId),
            // BUT: need to check user is still a member of the org
          ),
          ...permissionChecks,
        ),
      )
      .limit(1);

    return !!validInstallation;
  }
}
