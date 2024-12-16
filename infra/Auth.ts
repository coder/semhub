import { domain } from "./Dns";
import { allSecrets } from "./Secret";
import { database } from "./Supabase";

const authKv = new sst.cloudflare.Kv("AuthKv", {});

export const auth = new sst.cloudflare.Auth("Auth", {
  authenticator: {
    handler: "packages/workers/src/authenticator.ts",
    link: [authKv, database, ...allSecrets],
    // for reasons I don't fully understand, sometimes custom domain must be set up manually from the Workers > Settings > Domains and Routes tab
    domain: "auth." + domain,
    url: true,
  },
});

export const authUrl = auth.url;

export const outputs = {
  auth: authUrl,
};
