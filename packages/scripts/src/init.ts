import { closeConnection } from "@semhub/core/db";
import { GitHubIssue } from "@semhub/core/github/issue";
import { GitHubRepo } from "@semhub/core/github/repo";

try {
  await GitHubRepo.load();
  await GitHubIssue.sync();
} catch (error) {
  console.error("error loading repos", error);
} finally {
  await closeConnection();
}
