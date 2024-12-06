import { allSecrets } from "./Secret";
import { database } from "./Supabase";

new sst.cloudflare.Cron("Sync", {
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
          // {
          //   name: "SYNC_REPO_CRON_WORKFLOW",
          //   service: `semhub-sync-repo-cron-${$app.stage === "prod" ? "prod" : "dev"}`,
          // },
        ],
      },
    },
  },
  schedules: ["*/10 * * * *"],
});

// export const outputs = {
//   cronUrn: cron.urn,
// };
