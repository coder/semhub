import { eq, isNull } from "drizzle-orm";

import { repos } from "@/core/db/schema/entities/repo.sql";
import { repoSchema } from "@/core/github/schema.rest";
import { getDeps } from "@/deps";

const { db, closeConnection } = getDeps();

async function updateAvatarUrls() {
  const currRepos = await db
    .select({
      id: repos.id,
      ownerLogin: repos.ownerLogin,
      name: repos.name,
    })
    .from(repos)
    .where(isNull(repos.ownerAvatarUrl));

  for (const repo of currRepos) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo.ownerLogin}/${repo.name}`,
      );

      if (!response.ok) {
        console.error(
          `Failed to fetch ${repo.ownerLogin}/${repo.name}: ${response.statusText}`,
        );
        continue;
      }

      const data = repoSchema.parse(await response.json());

      await db
        .update(repos)
        .set({ ownerAvatarUrl: data.owner.avatar_url })
        .where(eq(repos.id, repo.id));

      console.log(`Updated avatar URL for ${repo.ownerLogin}/${repo.name}`);
    } catch (error) {
      console.error(`Error processing ${repo.ownerLogin}/${repo.name}:`, error);
    }
  }
}

try {
  await updateAvatarUrls();
} finally {
  await closeConnection();
}
