export const GITHUB_SCOPES_PERMISSION = {
  userEmail: "user:email",
  readUser: "read:user",
  repo: "repo",
} as const;

export type GithubScope = keyof typeof GITHUB_SCOPES_PERMISSION;
