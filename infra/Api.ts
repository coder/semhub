import { authKv } from "./Auth";
import { domain } from "./Dns";
import { allSecrets } from "./Secret";

// Create a secret that persists across deployments
const signingSecretString = new random.RandomString("SigningSecret", {
  special: false,
  length: 64,
});

// Make it linkable for use in other stacks
const signingSecret = new sst.Linkable("SigningSecret", {
  properties: {
    secretValue: signingSecretString.result,
  },
});
const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [authKv, ...allSecrets, signingSecret],
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
