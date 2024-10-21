import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { Resource } from "sst";

import { db } from "../db";
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
const coderRepos = ["coder"];

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
          set: {
            owner,
            name,
            htmlUrl,
            isPrivate,
          },
        });
    }
  }
  // eventually we can make this general
  export async function loaderCoderReposIssues() {
    // // for prod
    // general strategy: one repo at a time, idempotency, interruptible, minimise redoing work
    // - get all issues (including pull requests) and save in database
    // - for each repo, we save the latest updated_at, which we will use in the `since` parameter
    // - if the repo already exists in the database, we get all issues since the last updated_at
    // - for each issue we save, if it is already in database, we upsert

    // TODO: after loading issues, we subscribe to repo webhooks to receive updates
    // see: https://github.com/octokit/plugin-rest-endpoint-methods.js/blob/main/docs/repos/createWebhook.md
    // https://docs.github.com/en/webhooks/webhook-events-and-payloads?actionType=opened#issues
    for (const repo of coderRepos) {
      // const issues: Issue[] = [];
      // TODO: check to see if repo already exists in database, if so, use `since` parameter
      // const since =  ? : undefined
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
          // since,
        },
      );
      for await (const { data: issues } of iterator) {
        for (const [index, issue] of issues.entries()) {
          console.log("node_id", issue.node_id);
          console.log("number", issue.number);
          console.log("html_url", issue.html_url); // save so we can easy go to issue in browser and see what it's doing
          console.log("title", issue.title);
          console.log("user", issue.user); // user who created issue?
          console.log("labels", issue.labels);
          console.log("pull_request", issue.pull_request); // if defined, this is a PR
          console.log("state", issue.state);
          console.log("state_reason", issue.state_reason);
          console.log("draft", issue.draft);
          // console.log("closed_at", issue.closed_at);
          // console.log("created_at", issue.created_at);
          console.log("updated_at", issue.updated_at);
          if (index === 2) {
            break;
          }
          // fields to save:
          // - node_id: global node id used for GraphQL
          // - number: issue/PR number
          // - title
          // - body
          // - user (who created issue?)
          // - labels
          // - closed_at
          // - updated_at
          // - created_at
          // - draft (boolean)
          // state: open, closed
          // - state_reason: null, completed, reopened, not_planned
          // whatever we track, we will need to update via webhook in the future?
          // ignore for now:
          // - assignees
          // - milestones
          // - locked and active_lock_reason
          // - closed_by
          // - reactions
        }
      }
    }
  }
}
