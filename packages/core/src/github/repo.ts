import { getDb } from "../db";
import { conflictUpdateAllExcept } from "../db/helper";
import { repos } from "../db/schema/entities/repo.sql";
import { githubRepoSchema } from "./schema";
import { getRestOctokit } from "./shared";

const coderRepoNames = [
  "coder",
  "vscode-coder",
  "jetbrains-coder",
  "internal",
  "envbuilder",
  // "customers", // private
];
// for testing
// const coderRepos = ["nexus"];

export namespace GitHubRepo {
  export async function load() {
    const octokit = getRestOctokit();
    const { db } = getDb();
    for (const repo of coderRepoNames) {
      const { data: repoData } = await octokit.rest.repos.get({
        owner: "coder",
        repo,
      });
      const { success, data, error } = githubRepoSchema.safeParse(repoData);
      if (!success) {
        console.log("error parsing repo data from GitHub");
        console.error(error);
        console.log(repoData);
        break;
      }
      const {
        owner: { login: owner },
        name,
        node_id: nodeId,
        html_url: htmlUrl,
        private: isPrivate,
      } = data;
      await db
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
        });
    }
  }
}
