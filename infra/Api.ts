import { domain } from "./Dns";
import { allSecrets } from "./Secret";
import { database } from "./Supabase";

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [database, ...allSecrets],
  domain: "api." + domain,
  transform: {
    worker: {
      serviceBindings: [
        {
          name: "RATE_LIMITER",
          service: "rate-limiter",
        },
        // {
        //   name: "SYNC_REPO_INIT_WORKFLOW",
        //   service: "sync-repo-init",
        // },
      ],
    },
  },
});

export const apiUrl = hono.url;

export const outputs = {
  hono: hono.url,
};
