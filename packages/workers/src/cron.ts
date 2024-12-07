import type { EmbeddingParams } from "@semhub/wrangler/workflows/sync/embedding/update";
import type { RepoInitParams } from "@semhub/wrangler/workflows/sync/repo-init/init";
import { initNextRepo } from "@semhub/wrangler/workflows/sync/repo-init/init.util";
import type { WorkflowRPC } from "@semhub/wrangler/workflows/sync/util";

import { eq } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";

type Env = {
  REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>;
  SYNC_REPO_EMBEDDING_WORKFLOW: WorkflowRPC<EmbeddingParams>;
};

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    const { db, graphqlOctokit } = getDeps();
    switch (controller.cron) {
      case "*/5 * * * *": {
        // only repo being initialized at a time; this gets the next one
        await initNextRepo(db, env.REPO_INIT_WORKFLOW);
        break;
      }
      case "*/10 * * * *": {
        // this syncs issues
        const selectedRepos = await Repo.selectReposForIssueSync(db);
        for (const {
          repoId,
          repoIssuesLastUpdatedAt,
          repoName,
          repoOwner,
        } of selectedRepos) {
          try {
            const { issuesAndCommentsLabels } =
              await Github.getIssuesViaIterator(
                { repoId, repoName, repoOwner, repoIssuesLastUpdatedAt },
                graphqlOctokit,
                100,
              );
            await Repo.upsertIssuesCommentsLabels(issuesAndCommentsLabels, db);
            await db
              .update(repos)
              .set({
                lastSyncedAt: new Date(),
                syncStatus: "ready",
              })
              .where(eq(repos.id, repoId));
          } catch (e) {
            await db
              .update(repos)
              .set({ syncStatus: "error" })
              .where(eq(repos.id, repoId));
            throw e;
          }
        }
        break;
      }
      case "*/15 * * * *": {
        await env.SYNC_REPO_EMBEDDING_WORKFLOW.create({
          params: { mode: "cron" },
        });
        break;
      }
    }
    console.log("cron processed");
  },
};
