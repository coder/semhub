import { domain } from "./Dns";

new sst.cloudflare.Auth("auth", {
  authenticator: {
    handler: "packages/workers/src/auth.ts",
    domain: `auth.${domain}`,
  },
});
