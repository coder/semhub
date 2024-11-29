import { and, eq, getDb, isNotNull } from "@/db";

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
      // basically, get all repos that have been initialized
      .where(
        and(isNotNull(repos.issuesLastUpdatedAt), eq(repos.isSyncing, false)),
      );
  }
  type SyncingArgs =
    | {
        repoId: string;
        isSyncing: true;
      }
    | {
        repoId: string;
        isSyncing: false;
        syncedAt: Date;
      };
  export async function updateRepoIssueSyncing(args: SyncingArgs) {
    const { db } = getDb();
    if (args.isSyncing) {
      await db
        .update(repos)
        .set({ isSyncing: true })
        .where(eq(repos.id, args.repoId));
    } else {
      await db
        .update(repos)
        .set({ isSyncing: false, lastSyncedAt: args.syncedAt })
        .where(eq(repos.id, args.repoId));
    }
  }
  export async function getGithubRepoData(repoName: string, repoOwner: string) {
    const octokit = getRestOctokit();
    const { data: repoData } = await octokit.rest.repos.get({
      owner: repoOwner,
      repo: repoName,
    });
    const { success, data } = githubRepoSchema.safeParse(repoData);
    if (!success) {
      throw new Error("error parsing repo data from GitHub");
    }
    return data;
  }
  export async function createRepo(
    data: Awaited<ReturnType<typeof getGithubRepoData>>,
  ) {
    const { db } = getDb();
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
