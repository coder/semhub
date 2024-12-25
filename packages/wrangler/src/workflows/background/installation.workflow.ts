import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { and, eq, isNull } from "drizzle-orm";

import type { WranglerEnv } from "@/core/constants/wrangler.constant";
import { installationsToRepos } from "@/core/db/schema/entities/installation-to-repo.sql";
import { installations } from "@/core/db/schema/entities/installation.sql";
import { sendEmail } from "@/core/email";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import { getEnvPrefix } from "@/util";
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
    const { db, restOctokitAppFactory, emailClient } = getDeps(this.env);
    const { installationId } = event.payload;

    // Get the installation record with access token info
    const [installation] = await step.do(
      "get installation record with access token",
      getDbStepConfig("short"),
      async () => {
        return await db
          .select({
            githubInstallationId: installations.githubInstallationId,
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
            githubRepoId: installationsToRepos.githubRepoId,
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

    const { githubInstallationId } = installation;
    const restOctokit = restOctokitAppFactory(githubInstallationId);
    // Process each pending repo
    for (const { githubRepoId } of pendingRepos) {
      const res = await step.do("get repo by id", async () => {
        return await Github.getRepoById({
          githubRepoId,
          octokit: restOctokit,
        });
      });
      if (!res.exists || !res.data) {
        await step.do("send email notification", async () => {
          await sendEmail(
            {
              to: "warren@coder.com",
              subject: `Repo not found`,
              html: `<p>Repo not found: ${githubRepoId}</p>`,
            },
            emailClient,
            getEnvPrefix(this.env.ENVIRONMENT),
          );
        });
        continue;
      }
      const createdRepo = await step.do("create repo record", async () => {
        return await Repo.createRepo(res.data, db);
      });
      await step.do("update installation-to-repo mapping", async () => {
        await db
          .update(installationsToRepos)
          .set({ repoId: createdRepo.id })
          .where(eq(installationsToRepos.githubRepoId, githubRepoId));
      });
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
