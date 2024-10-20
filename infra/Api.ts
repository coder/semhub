import { allSecrets } from "./Secret";
import { database } from "./Supabase";

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [database, ...allSecrets],
});

export const apiUrl = hono.url;

export const outputs = {
  hono: hono.url,
};
