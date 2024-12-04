import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";

import type { EmbeddingParams } from "../embedding";
import { syncRepo } from "../sync";
import type { WorkflowRPC } from "../util";

interface Env extends WranglerSecrets {
  SYNC_REPO_INIT_WORKFLOW: Workflow;
  SYNC_REPO_EMBEDDING_WORKFLOW: WorkflowRPC<EmbeddingParams>;
}

// User-defined params passed to your workflow
export type InitSyncParams = {
  repo: {
    name: string;
    owner: string;
  };
};

export class SyncWorkflow extends WorkflowEntrypoint<Env, InitSyncParams> {
  async run(event: WorkflowEvent<InitSyncParams>, step: WorkflowStep) {
    const { repo } = event.payload;
    const { DATABASE_URL, GITHUB_PERSONAL_ACCESS_TOKEN, OPENAI_API_KEY } =
      this.env;
    const { db, graphqlOctokit, restOctokit } = getDeps({
      databaseUrl: DATABASE_URL,
      githubPersonalAccessToken: GITHUB_PERSONAL_ACCESS_TOKEN,
      openaiApiKey: OPENAI_API_KEY,
    });
    const data = await step.do("get repo", async () => {
      return await Github.getRepo(repo.name, repo.owner, restOctokit);
    });
    const createdRepo = await step.do("create repo", async () => {
      return await Repo.createRepo(data, db);
    });
    if (!createdRepo) {
      throw new NonRetryableError("Failed to create repo");
    }
    if (createdRepo.issuesLastUpdatedAt) {
      // should not initialize repo that has already been initialized
      throw new NonRetryableError("Repo has been initialized");
    }
    if (createdRepo.isSyncing) {
      // cannot initialize repo that is already syncing
      throw new NonRetryableError("Repo is already syncing");
    }
    await step.do("sync started, mark repo as syncing", async () => {
      await Repo.updateSyncStatus(
        {
          repoId: createdRepo.repoId,
          isSyncing: true,
        },
        db,
      );
    });
    await syncRepo({
      repo: createdRepo,
      step,
      db,
      graphqlOctokit,
      mode: "init",
      embeddingWorkflow: this.env.SYNC_REPO_EMBEDDING_WORKFLOW,
    });
    await step.do("update repo.issuesLastUpdatedAt", async () => {
      await Repo.updateSyncStatus(
        {
          repoId: createdRepo.repoId,
          isSyncing: false,
          successfulSynced: true,
          syncedAt: new Date(),
        },
        db,
      );
    });
    return;
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
  async create({ params }: { params: InitSyncParams }, env: Env) {
    const workflow = await env.SYNC_REPO_INIT_WORKFLOW.create({ params });
    return workflow.id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.SYNC_REPO_INIT_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.SYNC_REPO_INIT_WORKFLOW.get(id);
    const status = await instance.status();
    return status;
  },
} satisfies WorkflowRPC<InitSyncParams>;
