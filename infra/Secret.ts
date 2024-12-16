export const secret = {
  databaseUrl: new sst.Secret("DATABASE_URL"),
  githubPersonalAccessToken: new sst.Secret("GITHUB_PERSONAL_ACCESS_TOKEN"),
  openaiApiKey: new sst.Secret("OPENAI_API_KEY"),
  resendApiKey: new sst.Secret("RESEND_API_KEY"),
  githubAppClientId: new sst.Secret("SEMHUB_GITHUB_APP_CLIENT_ID"),
  githubAppClientSecret: new sst.Secret("SEMHUB_GITHUB_APP_CLIENT_SECRET"),
};

export const allSecrets = Object.values(secret);
