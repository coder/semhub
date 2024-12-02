import { Resource } from "sst";

import { createDb } from "@/core/db";
import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import { getGraphqlOctokit } from "@/core/github/shared";
import { Repo } from "@/core/repo";
import type RateLimiterWorker from "@/wrangler/rate-limiter/index";
import type { CronSyncParams } from "@/wrangler/workflows/sync-repo/cron";
import {
  generateCronSyncWorkflowId,
  type WorkflowWithTypedParams,
} from "@/wrangler/workflows/sync-repo/util";

type Env = {
  RATE_LIMITER: Service<RateLimiterWorker>;
  SYNC_REPO_CRON_WORKFLOW: WorkflowWithTypedParams<CronSyncParams>;
};

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    switch (controller.cron) {
      // Every ten minutes
      case "*/10 * * * *":
        const dbConfig = {
          connectionString: Resource.Supabase.databaseUrl,
          isProd: Resource.App.stage === "prod",
        };
        const { db } = createDb(dbConfig);
        const graphqlOctokit = getGraphqlOctokit(
          Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
        );
        const repos = await Repo.getReposForCron(db);
        await env.SYNC_REPO_CRON_WORKFLOW.create({
          id: generateCronSyncWorkflowId(),
          params: {
            db,
            repos,
            graphqlOctokit,
          },
        });
        // for each repo, call and start a workflow
        // for (const repo of repos) {
        //   await Repo.updateSyncStatus({
        //     repoId: repo.repoId,
        //     isSyncing: true,
        //   });
        //   // try catch: if error, we catch and set isSyncing to false
        //   const data = await Github.getIssuesCommentsLabels(repo);
        //   await Repo.upsertIssuesCommentsLabels({
        //     ...data,
        //     repoId: repo.repoId,
        //   });
        //   const issueIds = await Embedding.getOutdatedIssues();
        //   // TODO: decompose this further
        //   await Embedding.updateIssueEmbeddings({
        //     issueIds,
        //     rateLimiter: env.RATE_LIMITER,
        //   });
        //   // probably should get syncedAt from Embedding.sync
        //   await Repo.updateSyncStatus({
        //     repoId: repo.repoId,
        //     isSyncing: false,
        //     successfulSynced: true,
        //     syncedAt: new Date(),
        //   });
        // }
        break;
    }
    console.log("cron processed");
  },
};
