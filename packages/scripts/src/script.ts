import { eq } from "drizzle-orm";

import { repos } from "@/core/db/schema/entities/repo.sql";

import { getDeps } from "./deps";

const { db, closeConnection } = await getDeps();
const repoId = "rep_01JEK73YA0FDWVBEN21R4ATTB4";
try {
  const [result] = await db
    .select({
      initStatus: repos.initStatus,
      repoName: repos.name,
      repoOwner: repos.ownerLogin,
      isPrivate: repos.isPrivate,
      repoSyncCursor: repos.syncCursor,
    })
    .from(repos)
    .where(eq(repos.id, repoId))
    .limit(1);
  if (!result) {
    throw new Error("Repo not found");
  }
  console.log(result);
} catch (e) {
  console.error(e);
} finally {
  await closeConnection();
}
