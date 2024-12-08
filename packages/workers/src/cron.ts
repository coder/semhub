import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { EmbeddingParams } from "@/wrangler/workflows/sync/embedding/embedding.workflow";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init.workflow";
import { initNextRepo } from "@/wrangler/workflows/sync/repo-init/init.workflow.util";
import type { WorkflowRPC } from "@/wrangler/workflows/workflow.util";

type Env = {
  REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>;
  SYNC_EMBEDDING_WORKFLOW: WorkflowRPC<EmbeddingParams>;
  SYNC_ISSUE_WORKFLOW: WorkflowRPC;
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
        await db.transaction(
          async (tx) => {
            await Repo.selectReposForIssueSync(tx);
            // this syncs issues
            await env.SYNC_ISSUE_WORKFLOW.create({});
          },
          {
            isolationLevel: "serializable",
          },
        );
        break;
      }
      case "*/15 * * * *": {
        await env.SYNC_EMBEDDING_WORKFLOW.create({
          params: { mode: "cron" },
        });
        break;
      }
    }
    console.log("cron processed");
  },
};
