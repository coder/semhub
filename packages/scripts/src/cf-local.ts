// run this script to test Cloudflare Workers functionality locally

import { getDb } from "@semhub/core/db";
import { Embedding } from "@semhub/core/embedding";

const rateLimiter = {
  getDurationToNextRequest: async (key: string) => {
    // run `wrangler dev` from root, worker available at http://127.0.0.1:8787
    const response = await fetch("http://127.0.0.1:8787");
    const data = (await response.json()) as { value: number };
    return data.value;
  },
};

try {
  await Embedding.syncIssues(rateLimiter);
} catch (error) {
  console.error("error:", error);
} finally {
  const { closeConnection } = getDb();
  await closeConnection();
}
