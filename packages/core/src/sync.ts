import { and, eq, getDb, isNull } from "@/db";

import { repos } from "./db/schema/entities/repo.sql";

export namespace Sync {
  export async function initializeRepo(repoName: string) {
    const { db } = getDb();
    const repoId = await db
      .select({ id: repos.id })
      .from(repos)
      .where(and(isNull(repos.issuesLastUpdatedAt), eq(repos.name, repoName)));
    if (!repoId) {
      throw new Error(`No uninitialized repo found: ${repoName}`);
    }
  }
}
