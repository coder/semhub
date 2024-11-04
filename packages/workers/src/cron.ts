import { closeConnection } from "@semhub/core/db";
import { Embedding } from "@semhub/core/embedding";
import { GitHubIssue } from "@semhub/core/github/issue";

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
      // Write code for updating your API
      console.log("cron is:", controller.cron);
      switch (controller.cron) {
        // Every ten minutes
        case "*/10 * * * *":
          console.log("sync issues and embeddings");
          await GitHubIssue.sync();
          await Embedding.syncIssues(env.RATE_LIMITER);
          console.log("done syncing issues and embeddings");
          break;
      }
      console.log("cron processed");
    } catch (e) {
      console.error(e);
    } finally {
      await closeConnection();
    }
  },
};
