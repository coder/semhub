import { closeConnection } from "@semhub/core/db";
import { GitHubRepo } from "@semhub/core/github/repo";

try {
  await GitHubRepo.loadRepos();
  await GitHubRepo.loaderCoderReposIssues();
} catch (error) {
  console.error("error loading repos", error);
} finally {
  await closeConnection();
}
