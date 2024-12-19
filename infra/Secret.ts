export const secret = {
  githubPersonalAccessToken: new sst.Secret("GITHUB_PERSONAL_ACCESS_TOKEN"),
  openaiApiKey: new sst.Secret("OPENAI_API_KEY"),
  resendApiKey: new sst.Secret("RESEND_API_KEY"),
  githubAppClientId: new sst.Secret("SEMHUB_GITHUB_APP_CLIENT_ID"),
  githubAppClientSecret: new sst.Secret("SEMHUB_GITHUB_APP_CLIENT_SECRET"),
  betterAuthSecret: new sst.Secret("BETTER_AUTH_SECRET"),
};

export const allSecrets = Object.values(secret);
