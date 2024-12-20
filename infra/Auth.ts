import { domain } from "./Dns";
import { allSecrets } from "./Secret";

const authKv = new sst.cloudflare.Kv("AuthKv", {});

// Create a secret that persists across deployments
const signingSecretString = new random.RandomString("SigningSecret", {
  special: false,
  length: 64,
});

// Make it linkable for use in other stacks
export const signingSecret = new sst.Linkable("SigningSecret", {
  properties: {
    secretValue: signingSecretString.result,
  },
});

export const auth = new sst.cloudflare.Auth("Auth", {
  authenticator: {
    handler: "packages/workers/src/auth/authenticator.ts",
    link: [authKv, ...allSecrets, signingSecret],
    // for reasons I don't fully understand, sometimes custom domain must be set up manually from the Workers > Settings > Domains and Routes tab
    domain: "auth." + domain,
    url: true,
  },
});

export const outputs = {
  auth: auth.url,
};
