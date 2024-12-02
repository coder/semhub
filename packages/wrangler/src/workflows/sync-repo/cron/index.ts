import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import pMap from "p-map";

import type { DbClient } from "@/core/db";
import { Github } from "@/core/github";
import type { GraphqlOctokit } from "@/core/github/shared";
import type { OpenAIClient } from "@/core/openai";
import type { Repo } from "@/core/repo";

import { syncRepo } from "../sync";

type Env = {
  SYNC_REPO_CRON_WORKFLOW: Workflow;
};

export interface CronSyncParams {
  db: DbClient;
  repos: Awaited<ReturnType<typeof Repo.getReposForCron>>;
  graphqlOctokit: GraphqlOctokit;
  openai: OpenAIClient;
}

export class SyncWorkflow extends WorkflowEntrypoint<Env, CronSyncParams> {
  async run(event: WorkflowEvent<CronSyncParams>, step: WorkflowStep) {
    const { db, repos, graphqlOctokit, openai } = event.payload;
    await pMap(
      repos,
      (repo) => syncRepo(repo, step, db, graphqlOctokit, openai, "cron"),
      {
        // syncing two repos at a time
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
