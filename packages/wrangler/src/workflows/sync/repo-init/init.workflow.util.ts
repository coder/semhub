import type { DbClient } from "@/core/db";
import { Repo } from "@/core/repo";
import type { RepoInitParams } from "@/workflows/sync/repo-init/init.workflow";
import { NUM_CONCURRENT_INITS } from "@/workflows/sync/sync.param";
import type { WorkflowRPC } from "@/workflows/workflow.util";

import { generateSyncWorkflowId } from "../sync.util";

export async function initNextRepos(
  db: DbClient,
  workflow: WorkflowRPC<RepoInitParams>,
) {
  const res = await db.transaction(
    async (tx) => {
      const inProgressCount = await Repo.getInitInProgressCount(tx);
      if (inProgressCount >= NUM_CONCURRENT_INITS) {
        return {
          success: false,
          message: `no spare capacity to initialize repo, current count: ${inProgressCount}, max: ${NUM_CONCURRENT_INITS}`,
        } as const;
      }

      const numReposToInit = NUM_CONCURRENT_INITS - inProgressCount;
      const repos = await Repo.getInitReadyRepos(tx, numReposToInit);
      if (repos.length === 0) {
        return { success: false, message: "no repos to initialize" } as const;
      }
      for (const repo of repos) {
        const { repoId, repoName, repoOwner } = repo;
        await Repo.markInitInProgress(tx, [repoId]);
        await workflow.create({
          id: generateSyncWorkflowId(`init-${repoOwner}-${repoName}`),
          params: { repoId },
        });
      }
      return { success: true, repos } as const;
    },
    {
      isolationLevel: "serializable",
    },
  );
  return res;
}
