import { authKv } from "./Auth";
import { domain } from "./Dns";
import { allSecrets } from "./Secret";

const secretKeyString = new random.RandomString("SecretKey", {
  special: false,
  length: 64,
});
const secretKey = new sst.Linkable("SecretKey", {
  properties: {
    value: secretKeyString.result,
  },
});
const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [authKv, ...allSecrets, secretKey],
  domain: "api." + domain,
  transform: {
    worker: {
      // staging will bind to dev wrangler workers too
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
