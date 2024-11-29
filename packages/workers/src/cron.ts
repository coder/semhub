import { Embedding } from "@/core/embedding";
import { GitHubIssue } from "@/core/github/issue";
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
          const repos = await Repo.getCronRepos();
          // for each repo, call and start a workflow
          for (const repo of repos) {
            await Repo.updateRepoIssueSyncing({
              repoId: repo.repoId,
              isSyncing: true,
            });
            const data = await GitHubIssue.getIssuesWithMetadata(repo);
            await GitHubIssue.upsertIssues({ ...data, repoId: repo.repoId });
            await Repo.updateRepoIssueSyncing({
              repoId: repo.repoId,
              isSyncing: false,
              syncedAt: new Date(),
            });
            await Embedding.sync(env.RATE_LIMITER);
          }
          break;
      }
      console.log("cron processed");
    } catch (e) {
      console.error(e);
    }
  },
};
