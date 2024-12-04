import type { WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import pMap from "p-map";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";

import type { EmbeddingParams } from "../embedding";
import { syncRepo } from "../sync";
import type { WorkflowRPC } from "../util";

interface Env extends WranglerSecrets {
  SYNC_REPO_CRON_WORKFLOW: Workflow;
  SYNC_REPO_EMBEDDING_WORKFLOW: WorkflowRPC<EmbeddingParams>;
}

export class SyncWorkflow extends WorkflowEntrypoint<Env> {
  async run(_: unknown, step: WorkflowStep) {
    const { DATABASE_URL, GITHUB_PERSONAL_ACCESS_TOKEN, OPENAI_API_KEY } =
      this.env;
    const { db, graphqlOctokit } = getDeps({
      databaseUrl: DATABASE_URL,
      githubPersonalAccessToken: GITHUB_PERSONAL_ACCESS_TOKEN,
      openaiApiKey: OPENAI_API_KEY,
    });
    const repos = await step.do("get repos", async () => {
      return await Repo.getReposForCron(db);
    });
    for (const { repoId } of repos) {
      await step.do("sync started, mark repo as syncing", async () => {
        await Repo.updateSyncStatus(
          {
            repoId,
            isSyncing: true,
          },
          db,
        );
      });
    }
    try {
      await pMap(
        repos,
        (repo) =>
          syncRepo({
            repo,
            step,
            db,
            graphqlOctokit,
            mode: "cron",
            embeddingWorkflow: this.env.SYNC_REPO_EMBEDDING_WORKFLOW,
          }),
        {
          concurrency: 2,
        },
      );
    } catch (e) {
      for (const { repoId } of repos) {
        await step.do("sync started, mark repo as syncing", async () => {
          await Repo.updateSyncStatus(
            {
              repoId,
              isSyncing: false,
              successfulSynced: false,
            },
            db,
          );
        });
      }
      throw e;
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    // Return 400 for direct HTTP requests since workflows should be triggered via bindings
    return Response.json(
      { error: "Workflows must be triggered via bindings" },
      { status: 400 },
    );
  },
  async create(_, env: Env) {
    const { id } = await env.SYNC_REPO_CRON_WORKFLOW.create();
    return id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.SYNC_REPO_CRON_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.SYNC_REPO_CRON_WORKFLOW.get(id);
    return await instance.status();
  },
} satisfies WorkflowRPC;
