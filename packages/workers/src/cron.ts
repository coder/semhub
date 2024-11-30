import pMap from "p-map";

import { EMBEDDING_MODEL } from "@/core/constants/rate-limit";
import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import type RateLimiterWorker from "@/wrangler/rate-limiter/index";

import type { SyncWorkflowParams } from "./wrangler/workflow/sync";
import type { TypedWorkflow } from "./wrangler/workflow/types";

type Env = {
  RATE_LIMITER: Service<RateLimiterWorker>;
  SYNC_WORKFLOW: TypedWorkflow<SyncWorkflowParams>;
};

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ) {
    try {
      switch (controller.cron) {
        case "*/1 * * * *": {
          const duration =
            await env.RATE_LIMITER.getDurationToNextRequest(EMBEDDING_MODEL);
          // await env.SYNC_WORKFLOW.create({
          //   id: `sync-${Date.now()}`,
          //   params: {},
          // });
          console.log(duration);
          console.log(typeof duration);
          console.log("test");
          break;
        }
        // Every ten minutes
        case "*/10 * * * *":
          const repos = await Repo.getReposForCron();
          // await pMap(repos);
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
              syncedAt: new Date(),
            });
          }
          break;
      }
      console.log("cron processed");
    } catch (e) {
      console.error(e);
    }
  },
};
