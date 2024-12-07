import { allSecrets } from "./Secret";
import { database } from "./Supabase";

const createCronJob = (name: string, schedule: string) => {
  return new sst.cloudflare.Cron(name, {
    job: {
      handler: "./packages/workers/src/cron.ts",
      link: [database, ...allSecrets],
      transform: {
        worker: {
          serviceBindings: [
            {
              name: "REPO_INIT_WORKFLOW",
              service: `semhub-sync-repo-init-${$app.stage === "prod" ? "prod" : "dev"}`,
            },
            {
              name: "SYNC_REPO_EMBEDDING_WORKFLOW",
              service: `semhub-sync-repo-embedding-${$app.stage === "prod" ? "prod" : "dev"}`,
            },
            {
              name: "SYNC_ISSUE_CRON_WORKFLOW",
              service: `semhub-sync-issue-cron-${$app.stage === "prod" ? "prod" : "dev"}`,
            },
          ],
        },
      },
    },
    schedules: [schedule],
  });
};

// Create the three cron jobs with their specific schedules
createCronJob("SyncIssue", "*/10 * * * *");
createCronJob("InitCron", "*/5 * * * *");
createCronJob("SyncEmbedding", "*/15 * * * *");
