import { Github } from "@/core/github";
import { getDeps } from "@/deps";

const { graphqlOctokit } = getDeps();

function getApproximateSizeInBytes(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}
try {
  const result = await Github.getLatestRepoIssues({
    repoId: "rep_01JF50WHPNBNSBMDGFMZAB7E24",
    repoName: "go",
    repoOwner: "golang",
    octokit: graphqlOctokit,
    since: null,
    after: "Y3Vyc29yOnYyOpK5MjAyNC0xMi0xOFQwNDoyNTozMSswODowMM6ewFhF",
    numIssues: 1,
  });
  const {
    issuesAndCommentsLabels: { issuesToInsert },
  } = result;
  console.log(issuesToInsert[0]?.htmlUrl);
  const responseSize = getApproximateSizeInBytes(result);
  console.log(responseSize);
} catch (e) {
  console.error(e);
}
