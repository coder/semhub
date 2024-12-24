const hmacSecretKey = new random.RandomString("HmacSecretKey", {
  special: false,
  length: 64,
});
const githubWebhookSecret = new random.RandomString("GithubWebhookSecret", {
  special: false,
  length: 20,
});
const keys = new sst.Linkable("Keys", {
  properties: {
    hmacSecretKey: hmacSecretKey.result,
    githubWebhookSecret: githubWebhookSecret.result,
  },
});

export const secret = {
  databaseUrl: new sst.Secret("DATABASE_URL"),
  githubPersonalAccessToken: new sst.Secret("GITHUB_PERSONAL_ACCESS_TOKEN"),
  openaiApiKey: new sst.Secret("OPENAI_API_KEY"),
  resendApiKey: new sst.Secret("RESEND_API_KEY"),
  githubAppName: new sst.Secret("SEMHUB_GITHUB_APP_NAME"),
  githubAppClientId: new sst.Secret("SEMHUB_GITHUB_APP_CLIENT_ID"),
  githubAppClientSecret: new sst.Secret("SEMHUB_GITHUB_APP_CLIENT_SECRET"),
  keys,
};

export const allSecrets = Object.values(secret);

export const outputs = {
  // githubWebhookSecret: githubWebhookSecret.result,
};
