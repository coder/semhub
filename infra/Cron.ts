import { allSecrets } from "./Secret";
import { database } from "./Supabase";

new sst.cloudflare.Cron("Sync", {
  job: {
    handler: "./packages/workers/src/cron.ts",
    link: [database, ...allSecrets],
  },
  schedules: ["*/1 * * * *"],
});

// export const outputs = {
//   cronUrn: cron.urn,
// };
