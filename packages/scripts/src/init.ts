import { getDb } from "@semhub/core/db";
import { Embedding } from "@semhub/core/embedding";
import { GitHubIssue } from "@semhub/core/github/issue";
import { GitHubRepo } from "@semhub/core/github/repo";

try {
  await GitHubRepo.load();
  await GitHubIssue.sync();
  await Embedding.syncIssues();
} catch (error) {
  console.error("init error", error);
} finally {
  const { closeConnection } = getDb();
  await closeConnection();
}
