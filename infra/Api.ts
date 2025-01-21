import { auth, authKv } from "./Auth";
import { domain } from "./Dns";
import { mapStageToEnv } from "./helper";
import { allSecrets } from "./Secret";

export const cacheKv = new sst.cloudflare.Kv("CacheKv", {});

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [auth, authKv, cacheKv, ...allSecrets],
  domain: "api." + domain,
  transform: {
    worker: {
      // staging will bind to dev wrangler workers too
      serviceBindings: [
        {
          name: "REPO_INIT_WORKFLOW",
          service: `semhub-sync-repo-init-${mapStageToEnv($app.stage)}`,
        },
        {
          name: "INSTALLATION_WORKFLOW",
          service: `semhub-installation-${mapStageToEnv($app.stage)}`,
        },
      ],
    },
  },
});

export const apiUrl = hono.url;

export const outputs = {
  hono: hono.url,
};
