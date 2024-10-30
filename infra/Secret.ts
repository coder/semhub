export const secret = {
  GithubPersonalAccessToken: new sst.Secret("GITHUB_PERSONAL_ACCESS_TOKEN"),
};

export const allSecrets = Object.values(secret);
