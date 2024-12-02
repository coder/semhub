import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import pMap from "p-map";

import type { DbClient } from "@/core/db";
import { Github } from "@/core/github";
import type { GraphqlOctokit, RestOctokit } from "@/core/github/shared";
import { Repo } from "@/core/repo";

import { syncRepo } from "../shared";

type Env = {
  SYNC_WORKFLOW: Workflow;
};

// User-defined params passed to your workflow
export type InitSyncParams = {
  db: DbClient;
  repo: {
    name: string;
    owner: string;
  };
  restOctokit: RestOctokit;
  graphqlOctokit: GraphqlOctokit;
};

export class SyncWorkflow extends WorkflowEntrypoint<Env, InitSyncParams> {
  async run(event: WorkflowEvent<InitSyncParams>, step: WorkflowStep) {
    const { repo, restOctokit, graphqlOctokit, db } = event.payload;
    const data = await Github.getRepo(repo.name, repo.owner, restOctokit);
    const res = await Repo.createRepo(data, db);
    if (!res) {
      throw new NonRetryableError("Failed to create repo");
    }
    if (!res.issuesLastUpdatedAt) {
      // should not initialize repo that has already been initialized
      throw new NonRetryableError("Repo has been initialized");
    }
    await syncRepo(res, step);
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
