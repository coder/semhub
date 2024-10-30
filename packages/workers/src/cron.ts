import { closeConnection } from "@semhub/core/db";
import { GitHubRepo } from "@semhub/core/github/repo";

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
          await GitHubRepo.loadIssues();
          console.log("loaded issues");
          break;
        case "*/45 * * * *":
          // await updateAPI3();
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
