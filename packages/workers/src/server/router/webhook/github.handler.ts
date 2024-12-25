import { eq } from "drizzle-orm";

import type { DbClient } from "@/core/db";
import { installations } from "@/core/db/schema/entities/installation.sql";
import { organizations } from "@/core/db/schema/entities/organization.sql";
import { conflictUpdateOnly } from "@/core/db/utils/conflict";
import type { InstallationWebhook } from "@/core/github/schema.webhook";
import { Installation } from "@/core/installation";

export async function handleInstallationEvent(
  db: DbClient,
  data: InstallationWebhook,
) {
  const { action, installation, sender } = data;

  switch (action) {
    case "created": {
      switch (installation.target_type) {
        case "Organization": {
          // Create organization record if needed
          await db
            .insert(organizations)
            .values({
              nodeId: installation.account.node_id,
              login: installation.account.login,
              avatarUrl: installation.account.avatar_url,
              htmlUrl: installation.account.html_url,
            })
            .onConflictDoUpdate({
              target: [organizations.nodeId],
              set: conflictUpdateOnly(organizations, [
                "login",
                "avatarUrl",
                "htmlUrl",
                "name",
              ]),
            });
          break;
        }
        case "User": {
          // No need to create user record as it should already exist
          break;
        }
        default:
          installation.target_type satisfies never;
      }

      const targetId = await Installation.getTargetId({
        targetType: installation.target_type,
        nodeId: installation.account.node_id,
        db,
      });

      if (!targetId) {
        throw new Error(
          `Target not found. type=${installation.target_type} nodeId=${installation.account.node_id} login=${installation.account.login}`,
        );
      }

      const installedByUserId = await Installation.getInstallerUserId({
        nodeId: sender.node_id,
        installerType: sender.type,
        db,
      });

      if (!installedByUserId) {
        throw new Error(
          `Installer not found or not supported. type=${sender.type} nodeId=${sender.node_id} login=${sender.login}`,
        );
      }

      await db.insert(installations).values({
        githubInstallationId: installation.id.toString(),
        targetType: Installation.mapGithubTargetType(installation.target_type),
        targetId,
        repositorySelection: installation.repository_selection,
        installedByUserId,
        installedAt: new Date(installation.created_at),
        permissions: installation.permissions,
        permissionsUpdatedAt: new Date(),
      });
      break;
    }
    case "deleted": {
      await db
        .update(installations)
        .set({ uninstalledAt: new Date() })
        .where(
          eq(installations.githubInstallationId, installation.id.toString()),
        );
      break;
    }
    case "suspend": {
      // TODO: Future observability improvements:
      // - Send email to installation owner
      // - Track suspension metrics
      // - Alert on suspicious patterns (e.g., many suspensions in short time)
      console.log(
        `Installation suspended: id=${installation.id} account=${installation.account.login} by=${installation.suspended_by ?? "unknown"}`,
      );

      await db
        .update(installations)
        .set({
          suspendedAt: new Date(),
          suspendedBy: installation.suspended_by,
        })
        .where(
          eq(installations.githubInstallationId, installation.id.toString()),
        );
      break;
    }
    case "unsuspend": {
      // TODO: Future observability improvements:
      // - Send email notifying of restoration
      // - Track time-to-unsuspend metrics
      console.log(
        `Installation unsuspended: id=${installation.id} account=${installation.account.login}`,
      );

      await db
        .update(installations)
        .set({
          suspendedAt: null,
          suspendedBy: null,
        })
        .where(
          eq(installations.githubInstallationId, installation.id.toString()),
        );
      break;
    }
    case "new_permissions_accepted": {
      await db
        .update(installations)
        .set({
          permissions: installation.permissions,
          permissionsUpdatedAt: new Date(),
        })
        .where(
          eq(installations.githubInstallationId, installation.id.toString()),
        );
      break;
    }
    default:
      action satisfies never;
  }
}
