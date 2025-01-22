import { CRON_PATTERNS } from "@/core/constants/cron.constant";
import { unstuckIssueEmbeddings } from "@/core/embedding";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { EmbeddingParams } from "@/wrangler/workflows/sync/embedding/embedding.workflow";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init.workflow";
import { initNextRepos } from "@/wrangler/workflows/sync/repo-init/init.workflow.util";
import {
  NUM_CONCURRENT_EMBEDDING_CRONS,
  NUM_CONCURRENT_ISSUE_CRONS,
} from "@/wrangler/workflows/sync/sync.param";
import { generateSyncWorkflowId } from "@/wrangler/workflows/sync/sync.util";
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
      case CRON_PATTERNS.INIT: {
        await Repo.unstuckForInit(db);
        await initNextRepos(db, env.REPO_INIT_WORKFLOW);
        break;
      }
      case CRON_PATTERNS.SYNC_ISSUE: {
        // strictly speaking, this should not be necessary
        // BUT we are observing a bug where a repo is stuck in "in_progress"
        // and this workflow doesn't show up in Cloudflare Workflow's dashboard
        await Repo.unstuckForIssueSync(db);
        await db.transaction(
          async (tx) => {
            await Repo.enqueueForIssueSync(tx);
            for (let i = 0; i < NUM_CONCURRENT_ISSUE_CRONS; i++) {
              await env.SYNC_ISSUE_WORKFLOW.create({
                id: generateSyncWorkflowId("issue"),
              });
            }
          },
          {
            isolationLevel: "serializable",
          },
        );
        break;
      }
      case CRON_PATTERNS.SYNC_EMBEDDING: {
        await unstuckIssueEmbeddings(db);
        for (let i = 0; i < NUM_CONCURRENT_EMBEDDING_CRONS; i++) {
          await env.SYNC_EMBEDDING_WORKFLOW.create({
            id: generateSyncWorkflowId("embedding"),
            params: { mode: "cron" },
          });
        }
        break;
      }
    }
    // eslint-disable-next-line no-console
    console.log("cron processed");
  },
};
