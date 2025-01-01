import { getGithubRepoById } from "@/core/github";
import { getDeps } from "@/deps";

const { restOctokit } = getDeps();

try {
  // TODO: test and figure out response shape
  // const restOctokit = restOctokitAppFactory(1);
  const res = await getGithubRepoById({
    githubRepoId: "123",
    octokit: restOctokit,
  });
  // eslint-disable-next-line no-console
  console.log(res);
} catch (e) {
  console.error(e);
}
