import { getDb, isNotNull } from "@/db";

import { repos } from "./db/schema/entities/repo.sql";
import { conflictUpdateAllExcept } from "./db/utils/conflict";
import { githubRepoSchema } from "./github/schema";
import { getRestOctokit } from "./github/shared";

export namespace Repo {
  export async function getCronRepos() {
    const { db } = getDb();
    return await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        repoOwner: repos.owner,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
      })
      .from(repos)
      .where(isNotNull(repos.issuesLastUpdatedAt));
  }
  export async function getGithubData(repoName: string, repoOwner: string) {
    const octokit = getRestOctokit();
    const { db } = getDb();
    const { data: repoData } = await octokit.rest.repos.get({
      owner: repoOwner,
      repo: repoName,
    });
    const { success, data } = githubRepoSchema.safeParse(repoData);
    if (!success) {
      throw new Error("error parsing repo data from GitHub");
    }
    const {
      owner: { login: owner },
      name,
      node_id: nodeId,
      html_url: htmlUrl,
      private: isPrivate,
    } = data;
    return await db
      .insert(repos)
      .values({
        owner,
        name,
        nodeId,
        htmlUrl,
        isPrivate,
      })
      .onConflictDoUpdate({
        target: [repos.nodeId],
        set: conflictUpdateAllExcept(repos, ["nodeId", "id", "createdAt"]),
      })
      .returning({
        id: repos.id,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
      });
  }
}
