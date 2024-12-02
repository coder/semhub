import type { WorkflowStep } from "cloudflare:workers";
import pMap from "p-map";

import type { Repo } from "@/core/repo";

export const syncRepo = async (
  repo: Awaited<ReturnType<typeof Repo.getReposForCron>>[number],
  step: WorkflowStep,
) => {
  await step.do("mark repo as syncing", async () => {});
  // use try catch so that in failure, we will mark repo as not syncing
  try {
    await step.do(
      "get issues and associated comments and labels",
      async () => {},
    );
    await step.do("upsert issues, comments, and labels", async () => {});
    const outdatedIssues = await step.do("get outdated issues", async () => {
      return [];
    });
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
