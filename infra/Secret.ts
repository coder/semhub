export const secret = {
  GithubAppId: new sst.Secret("GITHUB_APP_ID"),
  GithubAppPrivateKey: new sst.Secret("GITHUB_APP_PRIVATE_KEY"),
  GithubAppInstallationId: new sst.Secret("GITHUB_APP_INSTALLATION_ID"),
};

export const allSecrets = Object.values(secret);
