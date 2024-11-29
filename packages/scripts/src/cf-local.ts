// run this script to test Cloudflare Workers functionality locally

import { getDb } from "@/core/db";
import { Embedding } from "@/core/embedding";

const rateLimiter = {
  getDurationToNextRequest: async (key: string) => {
    // run `wrangler dev` from root, worker available at http://127.0.0.1:8787
    const response = await fetch("http://127.0.0.1:8787");
    const data = (await response.json()) as { value: number };
    return data.value;
  },
};

try {
  await Embedding.sync(rateLimiter);
} catch (error) {
  console.error("error:", error);
} finally {
  const { closeConnection } = getDb();
  await closeConnection();
}
