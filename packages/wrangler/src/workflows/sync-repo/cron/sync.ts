import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import pMap from "p-map";

import { Github } from "@/core/github";
import { Repo } from "@/core/repo";

import { syncRepo } from "../shared";

type Env = {
  SYNC_WORKFLOW: Workflow;
};

// User-defined params passed to your workflow
export type SyncParams =
  | {
      mode: "init";
      repo: {
        name: string;
        owner: string;
      };
    }
  | {
      mode: "cron";
      repos: Awaited<ReturnType<typeof Repo.getReposForCron>>;
    };

export class SyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const { mode } = event.payload;
    switch (mode) {
      case "init": {
        const { repo } = event.payload;
        const data = await Github.getRepo(repo.name, repo.owner);
        const res = await Repo.createRepo(data);
        if (!res) {
          // TODO: change to nonretryable error
          throw new Error("Failed to create repo");
        }
        if (!res.issuesLastUpdatedAt) {
          // TODO: change to nonretryable error
          throw new Error("Repo has been initialized");
        }
        await syncRepo(res, step);
        return;
      }
      case "cron": {
        const { repos } = event.payload;
        await pMap(repos, (repo) => syncRepo(repo, step), { concurrency: 2 });
        return;
      }
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
};
