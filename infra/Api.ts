import { auth } from "./Auth";
import { domain } from "./Dns";
import { allSecrets } from "./Secret";

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [auth, ...allSecrets],
  domain: "api." + domain,
  environment: {
    OPENAUTH_ISSUER: auth.url.apply((url) => {
      if (typeof url !== "string") {
        throw new Error("Auth URL must be a string");
      }
      return url;
    }),
  },
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
