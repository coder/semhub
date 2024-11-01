import { closeConnection } from "@semhub/core/db";
import { Embedding } from "@semhub/core/embedding";
import { GitHubIssue } from "@semhub/core/github/issue";

export interface Env {}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    try {
      // Write code for updating your API
      switch (controller.cron) {
        // Every ten minutes
        case "*/10 * * * *":
          await GitHubIssue.sync();
          await Embedding.sync();
          console.log("loaded issues");
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
