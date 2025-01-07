import { repos } from "@/core/db/schema/entities/repo.sql";
import { Repo } from "@/core/repo";

import { getDeps } from "./deps";

const { db, closeConnection } = getDeps();

try {
  const allRepos = await db.select().from(repos);
  for (const repo of allRepos) {
    await Repo.setIssuesLastUpdatedAt(repo.id, db);
  }
} catch (e) {
  console.error(e);
} finally {
  await closeConnection();
}
