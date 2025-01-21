import { eq } from "drizzle-orm";

import { repos } from "@/core/db/schema/entities/repo.sql";

import { getDeps } from "./deps";

const { db, closeConnection } = getDeps();

try {
  const allRepos = await db
    .select({
      id: repos.id,
      issuesLastUpdated: repos.issuesLastUpdatedAt,
      syncCursor: repos.syncCursor,
    })
    .from(repos);

  for (const repo of allRepos) {
    if (!repo.syncCursor && repo.issuesLastUpdated) {
      await db
        .update(repos)
        .set({
          syncCursor: {
            since: repo.issuesLastUpdated,
            after: null,
          },
        })
        .where(eq(repos.id, repo.id));
    }
  }
} catch (e) {
  console.error(e);
} finally {
  await closeConnection();
}
