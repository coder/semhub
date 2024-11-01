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
    ctx: ExecutionContext,
  ) {
    try {
      // Write code for updating your API
      switch (controller.cron) {
        // every minute
        // case "* * * * *":
        // Every ten minutes
        case "*/10 * * * *":
          await GitHubIssue.sync();
          console.log("synced issues");
          //   await Embedding.sync(env.RATE_LIMITER);
          // console.log("synced embeddings");
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
