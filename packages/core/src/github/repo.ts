import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { Resource } from "sst";

import { and, db, eq, sql, type InferInsertModel } from "../db";
import { conflictUpdateAllExcept } from "../db/helper";
import {
  createIssueSchema,
  issues as issueTable,
} from "../db/schema/entities/issue.sql";
import { createRepoSchema, repos } from "../db/schema/entities/repo.sql";

const appId = Resource.GITHUB_APP_ID.value;
const privateKey = Resource.GITHUB_APP_PRIVATE_KEY.value;
const installationId = Resource.GITHUB_APP_INSTALLATION_ID.value;

// const coderRepos = [
//   "coder",
//   "vscode-coder",
//   "jetbrains-coder",
//   "internal",
//   // "envbuilder", // private
//   // "customers", // private
// ];
// for testing
// const coderRepos = ["nexus"];
const coderRepos = ["internal"];

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
      // honestly, not sure which other fields we should store, can always revisit this in the future
      const {
        owner: { login: owner },
        name,
        node_id: nodeId,
        html_url: htmlUrl,
        private: isPrivate,
      } = repoData;
      const repoDataParsed = createRepoSchema.parse({
        owner,
        name,
        nodeId,
        htmlUrl,
        isPrivate,
      });
      await db
        .insert(repos)
        .values(repoDataParsed)
        .onConflictDoUpdate({
          target: [repos.nodeId],
          set: conflictUpdateAllExcept(repos, ["nodeId"]),
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
        const issuesToInsert: InferInsertModel<typeof issueTable>[] = [];
        for (const issue of issues) {
          const {
            node_id: nodeId,
            number,
            title,
            state,
            user: author,
            pull_request: pullRequest,
            created_at: issueCreatedAt,
            updated_at: issueUpdatedAt,
            labels,
            closed_at: issueClosedAt,
            html_url: htmlUrl,
            body,
            draft,
            state: issueState,
            state_reason,
          } = issue;
          const issueType = pullRequest ? "pr" : "issue";
          const issueStateReason = state_reason ? state_reason : null;
          const isDraft = !!draft;
          const { success, data, error } = createIssueSchema.safeParse({
            nodeId,
            number,
            title,
            state,
            issueType,
            issueState,
            issueStateReason,
            issueCreatedAt,
            issueUpdatedAt,
            issueClosedAt,
            htmlUrl,
            author,
            labels,
            isDraft,
            body,
          });
          if (!success) {
            console.error(error);
            console.log({
              nodeId,
              number,
              title,
              state,
              issueType,
              issueState,
              issueStateReason,
              issueCreatedAt,
              issueUpdatedAt,
              issueClosedAt,
              htmlUrl,
              author,
              labels,
              isDraft,
              body,
            });
            break outerLoop; // Break out of both loops
          }
          issuesToInsert.push({
            ...data,
            repoId,
          });
        }
        await db.transaction(async (tx) => {
          await tx
            .insert(issueTable)
            .values(issuesToInsert)
            .onConflictDoUpdate({
              target: [issueTable.nodeId],
              set: conflictUpdateAllExcept(issueTable, ["nodeId"]),
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
