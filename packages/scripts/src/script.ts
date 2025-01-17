import { getLatestGithubRepoIssues } from "@/core/github";

import { getDeps } from "./deps";

const { graphqlOctokit } = await getDeps();
try {
  const res = await getLatestGithubRepoIssues({
    repoId: "rep_01JHHB967ZCNTEKV1ZVM2RAKQR",
    repoName: "coder",
    repoOwner: "coder",
    octokit: graphqlOctokit,
    since: null,
    numIssues: 100,
  });
  console.log(res);
} catch (e) {
  console.error(e);
}
