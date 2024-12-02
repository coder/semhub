import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import type RateLimiterWorker from "@/wrangler/rate-limiter/index";
import type { SyncParams } from "@/wrangler/workflows/sync-repo/cron/sync";
import type { WorkflowWithTypedParams } from "@/wrangler/workflows/sync-repo/utils";
import { generateSyncWorkflowId } from "@/wrangler/workflows/sync-repo/utils";

type Env = {
  RATE_LIMITER: Service<RateLimiterWorker>;
  SYNC_WORKFLOW: WorkflowWithTypedParams<SyncParams>;
};

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    switch (controller.cron) {
      // Every ten minutes
      case "*/10 * * * *":
        const repos = await Repo.getReposForCron();
        // await pMap(repos);
        await env.SYNC_WORKFLOW.create({
          id: generateSyncWorkflowId(),
          params: {
            mode: "cron",
            repos,
          },
        });
        // for each repo, call and start a workflow
        for (const repo of repos) {
          await Repo.updateSyncStatus({
            repoId: repo.repoId,
            isSyncing: true,
          });
          // try catch: if error, we catch and set isSyncing to false
          const data = await Github.getIssuesCommentsLabels(repo);
          await Repo.upsertIssuesCommentsLabels({
            ...data,
            repoId: repo.repoId,
          });
          const issueIds = await Embedding.getOutdatedIssues();
          // TODO: decompose this further
          await Embedding.updateIssueEmbeddings({
            issueIds,
            rateLimiter: env.RATE_LIMITER,
          });
          // probably should get syncedAt from Embedding.sync
          await Repo.updateSyncStatus({
            repoId: repo.repoId,
            isSyncing: false,
            successfulSynced: true,
            syncedAt: new Date(),
          });
        }
        break;
    }
    console.log("cron processed");
  },
};
