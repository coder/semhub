import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import pMap from "p-map";

import type { DbClient } from "@/core/db";
import { Github } from "@/core/github";
import type { GraphqlOctokit } from "@/core/github/shared";
import type { Repo } from "@/core/repo";

import { syncRepo } from "../shared";

type Env = {
  SYNC_WORKFLOW: Workflow;
};

export interface CronSyncParams {
  db: DbClient;
  repos: Awaited<ReturnType<typeof Repo.getReposForCron>>;
  graphqlOctokit: GraphqlOctokit;
}

export class SyncWorkflow extends WorkflowEntrypoint<Env, CronSyncParams> {
  async run(event: WorkflowEvent<CronSyncParams>, step: WorkflowStep) {
    const { db, repos } = event.payload;
    await pMap(repos, (repo) => syncRepo(repo, step), { concurrency: 2 });
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
