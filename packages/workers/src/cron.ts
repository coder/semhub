import type { RepoInitParams } from "@semhub/wrangler/workflows/sync/repo-init/init";
import { initNextRepo } from "@semhub/wrangler/workflows/sync/repo-init/init.util";

import { getDeps } from "@/deps";
import type { WorkflowRPC } from "@/wrangler/workflows/sync-repo/util";

type Env = {
  REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>;
};

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    switch (controller.cron) {
      case "*/5 * * * *": {
        const { db } = getDeps();
        await initNextRepo(db, env.REPO_INIT_WORKFLOW);
        break;
      }
      // Every ten minutes
      case "*/10 * * * *": {
        // await env.SYNC_REPO_CRON_WORKFLOW.create({
        //   id: generateCronSyncWorkflowId(),
        // });
        break;
      }
      case "*/15 * * * *": {
        return;
      }
    }
    console.log("cron processed");
  },
};
