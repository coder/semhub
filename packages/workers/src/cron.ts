import { CRON_PATTERNS } from "@/core/constants/cron.constant";
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
    const { db, emailClient, currStage } = getDeps();
    switch (controller.cron) {
      case CRON_PATTERNS.INIT: {
        await initNextRepos(
          db,
          env.REPO_INIT_WORKFLOW,
          emailClient,
          currStage.toLocaleUpperCase(),
        );
        break;
      }
      case CRON_PATTERNS.SYNC_ISSUE: {
        await db.transaction(
          async (tx) => {
            await Repo.enqueueReposForIssueSync(tx);
            for (let i = 0; i < NUM_CONCURRENT_ISSUE_CRONS; i++) {
              await env.SYNC_ISSUE_WORKFLOW.create({
                id: generateSyncWorkflowId("sync-issue"),
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
        for (let i = 0; i < NUM_CONCURRENT_EMBEDDING_CRONS; i++) {
          await env.SYNC_EMBEDDING_WORKFLOW.create({
            id: generateSyncWorkflowId("sync-embedding"),
            params: { mode: "cron" },
          });
        }
        break;
      }
    }
    console.log("cron processed");
  },
};
