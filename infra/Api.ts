import { auth, authKv } from "./Auth";
import { domain } from "./Dns";
import { allSecrets } from "./Secret";

export const searchCacheKv = new sst.cloudflare.Kv("SearchCacheKv", {});

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [auth, authKv, searchCacheKv, ...allSecrets],
  domain: "api." + domain,
  transform: {
    worker: {
      // staging will bind to dev wrangler workers too
      serviceBindings: [
        {
          name: "REPO_INIT_WORKFLOW",
          service: `semhub-sync-repo-init-${$app.stage === "prod" ? "prod" : "dev"}`,
        },
        {
          name: "INSTALLATION_WORKFLOW",
          service: `semhub-installation-${$app.stage === "prod" ? "prod" : "dev"}`,
        },
      ],
    },
  },
});

export const apiUrl = hono.url;

export const outputs = {
  hono: hono.url,
};
