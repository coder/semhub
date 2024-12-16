import { domain } from "./Dns";
import { allSecrets } from "./Secret";
import { database } from "./Supabase";

export const auth = new sst.cloudflare.Auth("auth", {
  authenticator: {
    handler: "packages/workers/src/authenticator.ts",
    domain: `auth.${domain}`,
    link: [database, ...allSecrets],
  },
});
