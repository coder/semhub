import { closeConnection } from "@semhub/core/db";
import { Embedding } from "@semhub/core/embedding";
import { GitHubIssue } from "@semhub/core/github/issue";
import { GitHubRepo } from "@semhub/core/github/repo";

try {
  // await GitHubRepo.load();
  await GitHubIssue.sync();
  await Embedding.sync();
} catch (error) {
  console.error("init error", error);
} finally {
  await closeConnection();
}
