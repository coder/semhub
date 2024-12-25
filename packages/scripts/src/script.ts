import { Github } from "@/core/github";
import { getDeps } from "@/deps";

const { restOctokit } = getDeps();

try {
  // TODO: test and figure out response shape
  // const restOctokit = restOctokitAppFactory(1);
  const res = await Github.getRepoById({
    githubRepoId: "123",
    octokit: restOctokit,
  });
  console.log(res);
} catch (e) {
  console.error(e);
}
