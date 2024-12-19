import { serverBaseUrl } from "./Api";
import { allSecrets } from "./Secret";
import { database } from "./Supabase";
import type { CronPatterns } from "./types";

const CRON_PATTERNS = {
  INIT: "*/5 * * * *",
  SYNC_ISSUE: "*/20 * * * *",
  SYNC_EMBEDDING: "0 * * * *",
} as const satisfies CronPatterns;

const createCronJob = (name: string, schedule: string) => {
  return new sst.cloudflare.Cron(name, {
    job: {
      handler: "./packages/workers/src/cron.ts",
      link: [database, ...allSecrets, serverBaseUrl],
      transform: {
        worker: {
          serviceBindings: [
            {
              name: "REPO_INIT_WORKFLOW",
              service: `semhub-sync-repo-init-${$app.stage === "prod" ? "prod" : "dev"}`,
            },
            {
              name: "SYNC_EMBEDDING_WORKFLOW",
              service: `semhub-sync-embedding-${$app.stage === "prod" ? "prod" : "dev"}`,
            },
            {
              name: "SYNC_ISSUE_WORKFLOW",
              service: `semhub-sync-issue-${$app.stage === "prod" ? "prod" : "dev"}`,
            },
          ],
        },
      },
    },
    schedules: [schedule],
  });
};

// Create the three cron jobs with their specific schedules
createCronJob("SyncIssue", CRON_PATTERNS.SYNC_ISSUE);
createCronJob("InitCron", CRON_PATTERNS.INIT);
createCronJob("SyncEmbedding", CRON_PATTERNS.SYNC_EMBEDDING);
