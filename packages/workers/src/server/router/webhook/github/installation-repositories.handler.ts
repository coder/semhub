import { eq } from "drizzle-orm";
import type { Resend } from "resend";

import type { DbClient } from "@/core/db";
import { installationsToRepos } from "@/core/db/schema/entities/installation-to-repo.sql";
import { installations } from "@/core/db/schema/entities/installation.sql";
import { conflictUpdateOnly } from "@/core/db/utils/conflict";
import type { InstallationRepositoriesWebhook } from "@/core/github/schema.webhook";
import { generateBackgroundWorkflowId } from "@/wrangler/workflows/background/background.util";
import type { InstallationParams } from "@/wrangler/workflows/background/installation.workflow";
import type { WorkflowRPC } from "@/wrangler/workflows/workflow.util";

export async function handleInstallationRepositoriesEvent(
  db: DbClient,
  _emailClient: Resend,
  data: InstallationRepositoriesWebhook,
  installationWorkflow: WorkflowRPC<InstallationParams>,
) {
  const { action, installation, repositories_added, repositories_removed } =
    data;

  // Get the installation record
  const [installationRecord] = await db
    .select({
      id: installations.id,
    })
    .from(installations)
    .where(eq(installations.githubInstallationId, installation.id));

  if (!installationRecord) {
    throw new Error(`Installation not found: ${installation.id}`);
  }

  switch (action) {
    case "added": {
      if (repositories_added.length > 0) {
        await db
          .insert(installationsToRepos)
          .values(
            repositories_added.map((repo) => ({
              installationId: installationRecord.id,
              repoNodeId: repo.node_id,
              githubRepoId: repo.id,
              metadata: {
                name: repo.name,
                fullName: repo.full_name,
                private: repo.private,
              },
              addedAt: new Date(),
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
            ]),
          });
        // Trigger installation workflow to process the newly added repositories
        await installationWorkflow.create({
          id: generateBackgroundWorkflowId(
            `installation-${installationRecord.id}`,
          ),
          params: {
            installationId: installationRecord.id,
          },
        });
      }
      break;
    }
    case "removed": {
      if (repositories_removed.length > 0) {
        const now = new Date();
        await db.transaction(async (tx) => {
          for (const repo of repositories_removed) {
            await tx
              .update(installationsToRepos)
              .set({ removedAt: now })
              .where(eq(installationsToRepos.repoNodeId, repo.node_id));
          }
        });
      }
      break;
    }
    default:
      action satisfies never;
  }
}
