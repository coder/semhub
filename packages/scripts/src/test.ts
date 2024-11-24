import { GitHubIssue } from "@/core/github/issue";

const query = GitHubIssue.getIssueUpsertQuery();

console.log(JSON.stringify(query, null, 2));
