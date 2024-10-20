import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { Resource } from "sst";

const appId = Resource.GITHUB_APP_ID.value;
const privateKey = Resource.GITHUB_APP_PRIVATE_KEY.value;
const installationId = Resource.GITHUB_APP_INSTALLATION_ID.value;

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId,
    privateKey,
    installationId,
  },
});

export module GitHubRepo {
  // eventually we can make this general
  export async function loadIssuesFromCoderRepos() {
    // // for prod
    // const coderRepos = [
    //   "coder",
    //   "vscode-coder",
    //   "jetbrains-coder",
    //   "internal",
    //   "envbuilder",
    //   "customers",
    // ];
    // for testing
    const coderRepos = ["coder"];
    // const coderRepos = ["nexus"];
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
        for (const issue of issues) {
          console.log("Issue #%d: %s", issue.number, issue.title);
        }
      }
    }
  }
}
