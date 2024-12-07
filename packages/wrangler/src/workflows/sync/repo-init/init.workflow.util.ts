import type { DbClient } from "@/core/db";
import { asc, count, eq } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import type { RepoInitParams } from "@/workflows/sync/repo-init/init.workflow";
import type { WorkflowRPC } from "@/workflows/sync/util";

export async function initNextRepo(
  db: DbClient,
  workflow: WorkflowRPC<RepoInitParams>,
) {
  // only init one repo at a time, so if there are other repos with initStatus in progress, return null
  return await db.transaction(
    async (tx) => {
      const [countRes] = await tx
        .select({
          count: count(),
        })
        .from(repos)
        .where(eq(repos.initStatus, "in_progress"));

      if (countRes && countRes.count > 0) {
        return {
          success: false,
          message: "another repo is being initialized",
        } as const;
      }
      const [result] = await tx
        .select({
          repoId: repos.id,
        })
        .from(repos)
        .where(eq(repos.initStatus, "ready"))
        // we always initialize oldest repo first
        .orderBy(asc(repos.createdAt))
        .limit(1);
      if (!result)
        return { success: false, message: "no repos to initialize" } as const;
      const { repoId } = result;
      await workflow.create({ params: { repoId } });
      await tx
        .update(repos)
        .set({ initStatus: "in_progress" })
        .where(eq(repos.id, repoId));
      return { success: true, repoId } as const;
    },
    {
      isolationLevel: "serializable",
    },
  );
}
