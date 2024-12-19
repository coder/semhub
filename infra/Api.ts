import { domain } from "./Dns";
import { allSecrets } from "./Secret";
import { database } from "./Supabase";

export const serverBaseUrl = new sst.Linkable("ServerBaseUrl", {
  properties: {
    url: "api." + domain,
  },
});

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [database, ...allSecrets, serverBaseUrl],
  domain: "api." + domain,
  transform: {
    worker: {
      serviceBindings: [
        {
          name: "RATE_LIMITER",
          service: `semhub-rate-limiter-${$app.stage === "prod" ? "prod" : "dev"}`,
        },
        {
          name: "REPO_INIT_WORKFLOW",
          service: `semhub-sync-repo-init-${$app.stage === "prod" ? "prod" : "dev"}`,
        },
      ],
    },
  },
});

export const apiUrl = hono.url;

export const outputs = {
  hono: hono.url,
};
