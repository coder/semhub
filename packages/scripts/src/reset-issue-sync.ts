import { repos } from "@/core/db/schema/entities/repo.sql";

import { getDeps } from "./deps";

async function main() {
  const { db } = await getDeps();
  await db.update(repos).set({
    initializedAt: null,
    initStatus: "ready",
    issuesLastUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: "ready",
  });
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
