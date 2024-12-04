import { generateCronSyncWorkflowId } from "@/wrangler/workflows/sync-repo/util";

type Env = {
  SYNC_REPO_CRON_WORKFLOW: Workflow;
};

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    switch (controller.cron) {
      // Every ten minutes
      case "*/10 * * * *":
        await env.SYNC_REPO_CRON_WORKFLOW.create({
          id: generateCronSyncWorkflowId(),
        });
        break;
    }
    console.log("cron processed");
  },
};
