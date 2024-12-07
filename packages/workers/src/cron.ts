import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { EmbeddingParams } from "@/wrangler/workflows/sync/embedding/update.workflow";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init.workflow";
import { initNextRepo } from "@/wrangler/workflows/sync/repo-init/init.workflow.util";
import type { WorkflowRPC } from "@/wrangler/workflows/sync/util";

type Env = {
  REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>;
  SYNC_REPO_EMBEDDING_WORKFLOW: WorkflowRPC<EmbeddingParams>;
  SYNC_ISSUE_CRON_WORKFLOW: WorkflowRPC;
};

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    const { db } = getDeps();
    switch (controller.cron) {
      case "*/5 * * * *": {
        // only repo being initialized at a time; this gets the next one
        await initNextRepo(db, env.REPO_INIT_WORKFLOW);
        break;
      }
      case "*/10 * * * *": {
        await Repo.selectReposForIssueSync(db);
        // this syncs issues
        await env.SYNC_ISSUE_CRON_WORKFLOW.create();
        break;
      }
      case "*/15 * * * *": {
        await env.SYNC_REPO_EMBEDDING_WORKFLOW.create({
          params: { mode: "cron" },
        });
        break;
      }
    }
    console.log("cron processed");
  },
};
