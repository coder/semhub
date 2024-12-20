import { domain } from "./Dns";
import { allSecrets } from "./Secret";

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [...allSecrets],
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
