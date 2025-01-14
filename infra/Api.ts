import { auth, authKv } from "./Auth";
import { domain } from "./Dns";
import { mapStageToEnv } from "./helper";
import { allSecrets } from "./Secret";

export const searchCacheKv = new sst.cloudflare.Kv("SearchCacheKv", {});

const search = new sst.aws.Function("Search", {
  url: {
    // auth implemented in lambda
    authorization: "none",
  },
  runtime: "go",
  handler: "./packages/search",
  // 256 vectors * 4 bytes * 1 million vectors = 1 GB
  // at this point, probably dominated by db select + bandwidth
  memory: "2048 MB",
  link: [...allSecrets],
  timeout: "30 seconds",
});

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [auth, authKv, searchCacheKv, search, ...allSecrets],
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
