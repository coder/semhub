import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import pMap from "p-map";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import type { Repo } from "@/core/repo";
import { getDeps } from "@/deps";

import type { EmbeddingParams } from "../embedding";
import { syncRepo } from "../sync";
import type { WorkflowWithTypedParams } from "../util";

interface Env extends WranglerSecrets {
  SYNC_REPO_CRON_WORKFLOW: Workflow;
  SYNC_REPO_EMBEDDING_WORKFLOW: WorkflowWithTypedParams<EmbeddingParams>;
}

export interface CronSyncParams {
  repos: Awaited<ReturnType<typeof Repo.getReposForCron>>;
}

export class SyncWorkflow extends WorkflowEntrypoint<Env, CronSyncParams> {
  async run(event: WorkflowEvent<CronSyncParams>, step: WorkflowStep) {
    const { repos } = event.payload;
    const { DATABASE_URL, GITHUB_PERSONAL_ACCESS_TOKEN, OPENAI_API_KEY } =
      this.env;
    const { db, graphqlOctokit } = getDeps({
      databaseUrl: DATABASE_URL,
      githubPersonalAccessToken: GITHUB_PERSONAL_ACCESS_TOKEN,
      openaiApiKey: OPENAI_API_KEY,
    });
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
};
