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
            name: "RATE_LIMITER",
            service: "rate-limiter",
          },
          {
            name: "SYNC_WORKFLOW",
            service: "workflows",
          },
        ],
      },
    },
  },
  schedules: ["*/1 * * * *"],
});

// export const outputs = {
//   cronUrn: cron.urn,
// };
