import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { and, eq, isNull } from "drizzle-orm";

import type { WranglerEnv } from "@/core/constants/wrangler.constant";
import { installationsToRepos } from "@/core/db/schema/entities/installation-to-repo.sql";
import { installations } from "@/core/db/schema/entities/installation.sql";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Github } from "@/core/github";
import { getDeps } from "@/deps";
import { getDbStepConfig } from "@/workflows/workflow.param";

import type { WorkflowRPC } from "../workflow.util";

interface Env extends WranglerEnv {
  INSTALLATION_WORKFLOW: Workflow;
}

export type InstallationParams = {
  installationId: string;
};

export class InstallationWorkflow extends WorkflowEntrypoint<
  Env,
  InstallationParams
> {
  async run(event: WorkflowEvent<InstallationParams>, step: WorkflowStep) {
    const { db, appAuthOctokit } = getDeps(this.env);
    const { installationId } = event.payload;

    // Get the installation record with access token info
    const [installation] = await step.do(
      "get installation record with access token",
      getDbStepConfig("short"),
      async () => {
        return await db
          .select({
            githubInstallationId: installations.githubInstallationId,
            accessToken: installations.accessToken,
            accessTokenExpiresAt: installations.accessTokenExpiresAt,
          })
          .from(installations)
          .where(eq(installations.id, installationId));
      },
    );

    if (!installation) {
      throw new NonRetryableError(`Installation not found: ${installationId}`);
    }

    // Find all repositories for this installation that haven't been processed yet
    const pendingRepos = await step.do(
      "find pending repositories for installation",
      getDbStepConfig("medium"),
      async () => {
        return await db
          .select({
            repoNodeId: installationsToRepos.repoNodeId,
            repoId: installationsToRepos.repoId,
          })
          .from(installationsToRepos)
          .where(
            and(
              eq(installationsToRepos.installationId, installationId),
              isNull(installationsToRepos.repoId),
              isNull(installationsToRepos.removedAt),
            ),
          );
      },
    );

    if (pendingRepos.length === 0) {
      return;
    }

    // Process each pending repo
    for (const pendingRepo of pendingRepos) {
      // try {
      //   // Get full repo info from GitHub
      //   const { exists, data: repoData } = await step.do(
      //     `get repo info for ${metadata.full_name}`,
      //     async () => {
      //       return await Github.getRepo({
      //         repoName: name,
      //         repoOwner: owner,
      //         octokit: appAuthOctokit,
      //       });
      //     },
      //   );
      //   if (!exists || !repoData) {
      //     console.error(
      //       `Repo not found: ${metadata.full_name} (${pendingRepo.repoNodeId})`,
      //     );
      //     continue;
      //   }
      //   // Create repo record
      //   const [newRepo] = await step.do(
      //     `create repo record for ${metadata.full_name}`,
      //     getDbStepConfig("short"),
      //     async () => {
      //       return await db
      //         .insert(repos)
      //         .values({
      //           nodeId: repoData.node_id,
      //           name: repoData.name,
      //           ownerLogin: repoData.owner.login,
      //           ownerAvatarUrl: repoData.owner.avatar_url,
      //           htmlUrl: repoData.html_url,
      //           isPrivate: repoData.private,
      //         })
      //         .returning({ id: repos.id });
      //     },
      //   );
      //   if (!newRepo) {
      //     throw new Error(
      //       `Failed to create repo record for ${metadata.full_name}`,
      //     );
      //   }
      //   // Update installation-to-repo mapping with the new repo ID
      //   await step.do(
      //     `update installation-to-repo mapping for ${metadata.full_name}`,
      //     getDbStepConfig("short"),
      //     async () => {
      //       await db
      //         .update(installationsToRepos)
      //         .set({ repoId: newRepo.id })
      //         .where(
      //           and(
      //             eq(installationsToRepos.installationId, installationId),
      //             eq(installationsToRepos.repoNodeId, pendingRepo.repoNodeId),
      //           ),
      //         );
      //     },
      //   );
      //   console.log(
      //     `Successfully processed repo ${metadata.full_name} (${pendingRepo.repoNodeId})`,
      //   );
      // } catch (error) {
      //   console.error(
      //     `Error processing repo ${metadata.full_name} (${pendingRepo.repoNodeId}):`,
      //     error,
      //   );
      //   // Continue with other repos even if one fails
      // }
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return Response.json(
      { error: "Workflows must be triggered via bindings" },
      { status: 400 },
    );
  },
  async create(options, env: Env) {
    const workflow = await env.INSTALLATION_WORKFLOW.create(options);
    return workflow.id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.INSTALLATION_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.INSTALLATION_WORKFLOW.get(id);
    const status = await instance.status();
    return status;
  },
} satisfies WorkflowRPC<InstallationParams>;
