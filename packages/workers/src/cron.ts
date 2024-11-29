import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";

import type RateLimiterWorker from "./rate-limiter";

type Env = {
  RATE_LIMITER: Service<RateLimiterWorker>;
};

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ) {
    try {
      switch (controller.cron) {
        // Every ten minutes
        case "*/10 * * * *":
          const repos = await Repo.getReposForCron();
          // for each repo, call and start a workflow
          for (const repo of repos) {
            await Repo.updateSyncStatus({
              repoId: repo.repoId,
              isSyncing: true,
            });
            const data = await Github.getIssuesWithMetadata(repo);
            await Repo.upsertIssues({ ...data, repoId: repo.repoId });
            await Embedding.sync(env.RATE_LIMITER);
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
