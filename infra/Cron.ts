import { allSecrets } from "./Secret";
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
      link: [...allSecrets],
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

// only run these if NOT on staging, else we will get duplicate crons on dev and staging running against the same db
if ($app.stage !== "stg") {
  createCronJob("SyncIssue", CRON_PATTERNS.SYNC_ISSUE);
  createCronJob("InitCron", CRON_PATTERNS.INIT);
  createCronJob("SyncEmbedding", CRON_PATTERNS.SYNC_EMBEDDING);
}
