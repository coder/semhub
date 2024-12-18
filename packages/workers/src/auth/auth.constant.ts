export const githubLogin = {
  provider: "github-login" as const,
  scopes: ["user:email", "read:user"], // actually I suspect read:user is not necessary
};

export const githubRepo = {
  githubRepo: {
    provider: "github-repo" as const,
    scopes: ["repo"],
  },
};
