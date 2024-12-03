import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/rate-limiter";

import { syncRepo } from "../sync";
import type { WorkflowWithTypedParams } from "../util";

interface Env extends WranglerSecrets {
  RATE_LIMITER: Service<RateLimiterWorker>;
  SYNC_REPO_INIT_WORKFLOW: WorkflowWithTypedParams<InitSyncParams>;
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
    const { db, graphqlOctokit, openai, restOctokit } = getDeps({
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
    await syncRepo(
      createdRepo,
      step,
      db,
      graphqlOctokit,
      openai,
      "init",
      this.env.RATE_LIMITER,
    );
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
    await env.SYNC_REPO_INIT_WORKFLOW.create({ params });
  },
};
