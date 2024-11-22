import { getDb } from "@/core/db";
import { Embedding } from "@/core/embedding";
import { GitHubIssue } from "@/core/github/issue";
import { GitHubRepo } from "@/core/github/repo";

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
