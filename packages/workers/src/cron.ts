import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { CronSyncParams } from "@/wrangler/workflows/sync-repo/cron";
import {
  generateCronSyncWorkflowId,
  type WorkflowWithTypedParams,
} from "@/wrangler/workflows/sync-repo/util";

type Env = {
  SYNC_REPO_CRON_WORKFLOW: WorkflowWithTypedParams<CronSyncParams>;
};

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    switch (controller.cron) {
      // Every ten minutes
      case "*/10 * * * *":
        const { db } = getDeps();
        const repos = await Repo.getReposForCron(db);
        await env.SYNC_REPO_CRON_WORKFLOW.create({
          id: generateCronSyncWorkflowId(),
          params: {
            repos,
          },
        });
        break;
    }
    console.log("cron processed");
  },
};
