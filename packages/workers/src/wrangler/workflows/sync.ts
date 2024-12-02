import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import pMap from "p-map";

import { Github } from "@/core/github";
import { Repo } from "@/core/repo";

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
    const syncRepo = async (
      repo: Awaited<ReturnType<typeof Repo.getReposForCron>>[number],
    ) => {
      await step.do("mark repo as syncing", async () => {});
      // use try catch so that in failure, we will mark repo as not syncing
      try {
        await step.do(
          "get issues and associated comments and labels",
          async () => {},
        );
        await step.do("upsert issues, comments, and labels", async () => {});
        const outdatedIssues = await step.do(
          "get outdated issues",
          async () => {
            return [];
          },
        );
        // use multiple workflows to update issue embeddings in batches
        const batchProcessIssues = async (issues: typeof outdatedIssues) => {
          const embeddings = await step.do("generate embeddings", async () => {
            return [];
          });
          await step.do("upsert embeddings", async () => {});
        };
        await pMap(outdatedIssues, batchProcessIssues, { concurrency: 3 });
        await step.do("mark repo as not syncing", async () => {});
      } catch (e) {
        await step.do("mark repo as not syncing", async () => {});
        throw e;
      }
    };
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
        await syncRepo(res);
        return;
      }
      case "cron": {
        const { repos } = event.payload;
        await pMap(repos, syncRepo, { concurrency: 2 });
        return;
      }
    }
  }
}

