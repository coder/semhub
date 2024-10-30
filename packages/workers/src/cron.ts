import { GitHubRepo } from "@semhub/core/github/repo";

export interface Env {}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    // Write code for updating your API
    switch (controller.cron) {
      // TODO: switch to 10 minutes
      case "*/1 * * * *":
        // Every ten minutes
        console.log("loading issues");
        await GitHubRepo.loadIssues();
        console.log("loaded issues");
        break;
      case "*/45 * * * *":
        // await updateAPI3();
        break;
    }
    console.log("cron processed");
  },
};
