import { Github } from "@/core/github";
import { getDeps } from "@/deps";

const { graphqlOctokit } = getDeps();

const query = await Github.getIssueNumbers({
  repoOwner: "getcursor",
  repoName: "cursor",
  octokit: graphqlOctokit,
});

console.log(JSON.stringify(query, null, 2));
