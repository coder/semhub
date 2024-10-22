import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { Resource } from "sst";

import { and, db, eq } from "../db";
import { conflictUpdateAllExcept } from "../db/helper";
import {
  issues as issueTable,
  type CreateIssue,
} from "../db/schema/entities/issue.sql";
import { repos } from "../db/schema/entities/repo.sql";
import {
  githubIssueSchema,
  githubRepoSchema,
  type GitHubIssue,
} from "./schema";

const appId = Resource.GITHUB_APP_ID.value;
const privateKey = Resource.GITHUB_APP_PRIVATE_KEY.value;
const installationId = Resource.GITHUB_APP_INSTALLATION_ID.value;

const coderRepos = [
  "coder",
  "vscode-coder",
  "jetbrains-coder",
  "internal",
  "envbuilder",
  // "customers", // private
];
// for testing
// const coderRepos = ["nexus"];

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId,
    privateKey,
    installationId,
  },
});

export module GitHubRepo {
  export async function loadRepos() {
    for (const repo of coderRepos) {
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
  // eventually we can make this general
  export async function loaderCoderReposIssues() {
    // general strategy: one repo at a time, ensure idempotency, interruptible, minimise redoing work, update if conflict
    // - get all issues (including pull requests) and save in database one batch at a time
    // - for each repo, we save the latest updated_at, which we will use in the `since` parameter
    // - if the repo already exists in the database, we get all issues since the last updated_at
    // - for each issue we save, if it is already in database, we upsert
    // TODO: after loading issues, we subscribe to repo webhooks to receive updates
    // see: https://github.com/octokit/plugin-rest-endpoint-methods.js/blob/main/docs/repos/createWebhook.md
    // https://docs.github.com/en/webhooks/webhook-events-and-payloads?actionType=opened#issues
    outerLoop: for (const repo of coderRepos) {
      const repoFromDb = await db
        .select({
          id: repos.id,
          issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
        })
        .from(repos)
        .where(and(eq(repos.owner, "coder"), eq(repos.name, repo)));
      if (!repoFromDb[0]) {
        throw new Error(`Repo ${repo} not found`);
      }
      const issuesLastUpdatedAt = repoFromDb[0].issuesLastUpdatedAt;
      const repoId = repoFromDb[0].id;
      const iterator = octokit.paginate.iterator(
        //  see: https://github.com/octokit/plugin-rest-endpoint-methods.js/blob/main/docs/issues/listForRepo.md
        octokit.rest.issues.listForRepo,
        {
          owner: "coder",
          repo,
          per_page: 100,
          sort: "updated",
          direction: "asc",
          state: "all",
          since: issuesLastUpdatedAt // only accepts ISO strings
            ? issuesLastUpdatedAt.toISOString()
            : undefined,
        },
      );
      for await (const { data: issues } of iterator) {
        if (issues.length === 0) {
          continue;
        }
        const lastIssueUpdatedAt = new Date(
          issues[issues.length - 1]!.updated_at,
        );
        const issuesToInsert: CreateIssue[] = [];
        for (const issue of issues) {
          const parsedIssue = githubIssueSchema.safeParse(issue);
          if (!parsedIssue.success) {
            console.log("error parsing issues data from GitHub");
            console.error(parsedIssue.error);
            console.log(issue);
            break outerLoop; // Break out of both loops
          }
          const transformedIssue = transformGitHubIssue(
            parsedIssue.data,
            repoId,
          );
          issuesToInsert.push(transformedIssue);
        }
        await db.transaction(async (tx) => {
          await tx
            .insert(issueTable)
            .values(issuesToInsert)
            .onConflictDoUpdate({
              target: [issueTable.nodeId],
              set: conflictUpdateAllExcept(issueTable, [
                "nodeId",
                "id",
                "createdAt",
              ]),
            });
          await tx
            .update(repos)
            .set({
              issuesLastUpdatedAt: lastIssueUpdatedAt,
            })
            .where(and(eq(repos.owner, "coder"), eq(repos.name, repo)));
        });
      }
    }
  }
}

function transformGitHubIssue(issue: GitHubIssue, repoId: string): CreateIssue {
  return {
    repoId,
    nodeId: issue.node_id,
    number: issue.number,
    author: {
      name: issue.user.login,
      htmlUrl: issue.user.html_url,
      nodeId: issue.user.node_id,
    },
    issueType: issue.pull_request ? "pr" : "issue",
    issueState: issue.state,
    issueStateReason: issue.state_reason ?? "null",
    htmlUrl: issue.html_url,
    title: issue.title,
    body: issue.body ?? undefined,
    labels: issue.labels.map((label) => ({
      nodeId: label.node_id,
      name: label.name,
      color: label.color,
      description: label.description,
    })),
    isDraft: issue.draft ?? false,
    issueCreatedAt: new Date(issue.created_at),
    issueUpdatedAt: new Date(issue.updated_at),
    issueClosedAt: issue.closed_at ? new Date(issue.closed_at) : null,
  };
}
