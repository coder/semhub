import { database } from "./supabase";

const hono = new sst.cloudflare.Worker("Hono", {
  url: true,
  handler: "./packages/workers/src/api.ts",
  link: [database],
});

export const outputs = {
  hono: hono.url,
};
