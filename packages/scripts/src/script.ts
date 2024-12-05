import { Github } from "@/core/github";
import { getDeps } from "@/deps";

const { graphqlOctokit } = getDeps();

const query = await Github.getIssuesArrayToChunk({
  repoOwner: "getcursor",
  repoName: "cursor",
  octokit: graphqlOctokit,
  since: null,
  numIssuesPerQuery: 100,
});

console.log(JSON.stringify(query, null, 2));
