import { domain } from "./Dns";
import { allSecrets } from "./Secret";

export const authKv = new sst.cloudflare.Kv("AuthKv", {});

const auth = new sst.cloudflare.Auth("Auth", {
  authenticator: {
    handler: "packages/workers/src/auth/authenticator.ts",
    link: [authKv, ...allSecrets],
    // for reasons I don't fully understand, sometimes custom domain must be set up manually from the Workers > Settings > Domains and Routes tab
    domain: "auth." + domain,
    url: true,
  },
});

export const outputs = {
  auth: auth.url,
};
