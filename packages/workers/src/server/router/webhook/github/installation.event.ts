import { eq } from "drizzle-orm";
import type { Resend } from "resend";

import type { DbClient } from "@/core/db";
import { installationsToRepos } from "@/core/db/schema/entities/installation-to-repo.sql";
import { installations } from "@/core/db/schema/entities/installation.sql";
import { organizations } from "@/core/db/schema/entities/organization.sql";
import { conflictUpdateOnly } from "@/core/db/utils/conflict";
import type { InstallationWebhook } from "@/core/github/schema.webhook";
import { Installation } from "@/core/installation";
import { generateBackgroundWorkflowId } from "@/wrangler/workflows/background/background.util";
import type { InstallationParams } from "@/wrangler/workflows/background/installation.workflow";
import type { WorkflowRPC } from "@/wrangler/workflows/workflow.util";

export async function handleInstallationEvent(
  db: DbClient,
  _emailClient: Resend,
  data: InstallationWebhook,
  installationWorkflow: WorkflowRPC<InstallationParams>,
) {
  const { action, installation, sender, repositories } = data;

  switch (action) {
    case "created": {
      const installationId = await db.transaction(async (tx) => {
        switch (installation.target_type) {
          case "Organization": {
            // Create organization record if needed
            await tx
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

        // todo: deal with orphaned user, don't do this join here
        const targetId = await Installation.getTargetId({
          targetType: installation.target_type,
          nodeId: installation.account.node_id,
          db: tx,
        });
        if (!targetId) {
          throw new Error(
            `Target not found. type=${installation.target_type} nodeId=${installation.account.node_id} login=${installation.account.login}`,
          );
        }

        const installedByUserId = await Installation.getInstallerUserId({
          nodeId: sender.node_id,
          installerType: sender.type,
          db: tx,
        });

        if (!installedByUserId) {
          throw new Error(
            `Installer not found or not supported. type=${sender.type} nodeId=${sender.node_id} login=${sender.login} htmlUrl=${sender.html_url}`,
          );
        }

        const [newInstallation] = await tx
          .insert(installations)
          .values({
            githubInstallationId: installation.id,
            targetType: Installation.mapGithubTargetType(
              installation.target_type,
            ),
            targetId,
            targetNodeId: installation.account.node_id,
            targetGithubId: installation.account.id,
            repositorySelection: installation.repository_selection,
            installedByUserId,
            installedAt: new Date(installation.created_at),
            permissions: installation.permissions,
            permissionsUpdatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [installations.githubInstallationId],
            set: conflictUpdateOnly(installations, [
              "targetType",
              "targetId",
              "repositorySelection",
              "installedByUserId",
            ]),
          })
          .returning({
            id: installations.id,
            installedAt: installations.installedAt,
          });

        if (!newInstallation) {
          throw new Error("Failed to create installation");
        }

        // Process repositories if they exist in the webhook
        if (repositories.length > 0) {
          await tx
            .insert(installationsToRepos)
            .values(
              repositories.map((repo) => ({
                installationId: newInstallation.id,
                repoNodeId: repo.node_id,
                githubRepoId: repo.id,
                metadata: {
                  name: repo.name,
                  fullName: repo.full_name,
                  private: repo.private,
                },
                addedAt: newInstallation.installedAt,
                removedAt: null, // unlikely to be needed
              })),
            )
            .onConflictDoUpdate({
              target: [
                installationsToRepos.installationId,
                installationsToRepos.githubRepoId,
              ],
              set: conflictUpdateOnly(installationsToRepos, [
                "addedAt",
                "metadata",
                "removedAt",
              ]),
            });
        }
        return newInstallation.id;
      });

      await installationWorkflow.create({
        id: generateBackgroundWorkflowId(installationId),
        params: {
          installationId,
        },
      });
      break;
    }
    case "deleted": {
      await db.transaction(async (tx) => {
        await tx
          .update(installations)
          .set({ uninstalledAt: new Date() })
          .where(eq(installations.githubInstallationId, installation.id));
      });
      break;
    }
    case "suspend": {
      // TODO: Future observability improvements:
      // - Send email to installation owner
      // - Track suspension metrics
      // - Alert on suspicious patterns (e.g., many suspensions in short time)
      // eslint-disable-next-line no-console
      console.log(
        `Installation suspended: id=${installation.id} account=${installation.account.login} by=${installation.suspended_by ?? "unknown"}`,
      );

      await db.transaction(async (tx) => {
        await tx
          .update(installations)
          .set({
            suspendedAt: new Date(),
            suspendedBy: installation.suspended_by,
          })
          .where(eq(installations.githubInstallationId, installation.id));
      });
      break;
    }
    case "unsuspend": {
      // TODO: Future observability improvements:
      // - Send email notifying of restoration
      // - Track time-to-unsuspend metrics
      // eslint-disable-next-line no-console
      console.log(
        `Installation unsuspended: id=${installation.id} account=${installation.account.login}`,
      );

      await db.transaction(async (tx) => {
        await tx
          .update(installations)
          .set({
            suspendedAt: null,
            suspendedBy: null,
          })
          .where(eq(installations.githubInstallationId, installation.id));
      });
      break;
    }
    case "new_permissions_accepted": {
      await db.transaction(async (tx) => {
        await tx
          .update(installations)
          .set({
            permissions: installation.permissions,
            permissionsUpdatedAt: new Date(),
          })
          .where(eq(installations.githubInstallationId, installation.id));
      });
      break;
    }
    default:
      action satisfies never;
  }
}
