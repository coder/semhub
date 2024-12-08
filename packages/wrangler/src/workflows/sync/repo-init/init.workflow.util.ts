import type { DbClient } from "@/core/db";
import { Repo } from "@/core/repo";
import type { RepoInitParams } from "@/workflows/sync/repo-init/init.workflow";
import type { WorkflowRPC } from "@/workflows/sync/util";

export async function initNextRepo(
  db: DbClient,
  workflow: WorkflowRPC<RepoInitParams>,
) {
  return await db.transaction(
    async (tx) => {
      const inProgressCount = await Repo.getInitInProgressCount(tx);
      // only init one repo at a time, so if another is in progress, return false
      if (inProgressCount > 0) {
        return {
          success: false,
          message: "another repo is being initialized",
        } as const;
      }

      const repoId = await Repo.getInitReadyRepo(tx);
      if (!repoId) {
        return { success: false, message: "no repos to initialize" } as const;
      }

      await workflow.create({ params: { repoId } });
      await Repo.markInitInProgress(tx, repoId);
      return { success: true, repoId } as const;
    },
    {
      isolationLevel: "serializable",
    },
  );
}
