export const GITHUB_SCOPES_PERMISSION = {
  userEmail: "user:email",
  readUser: "read:user",
} as const;

export type GithubScope =
  (typeof GITHUB_SCOPES_PERMISSION)[keyof typeof GITHUB_SCOPES_PERMISSION];
