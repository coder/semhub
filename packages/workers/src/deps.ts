import { Resource } from "sst";

import { createDb } from "@/core/db";
import { getEmailClient } from "@/core/email";
import { getGraphqlOctokit, getRestOctokit } from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps() {
  const currStage = Resource.App.stage;
  const { db } = createDb({
    connectionString: Resource.DATABASE_URL.value,
    isProd: currStage === "prod",
  });

  const openai = createOpenAIClient(Resource.OPENAI_API_KEY.value);

  const graphqlOctokit = getGraphqlOctokit(
    Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
  );

  const restOctokit = getRestOctokit(
    Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
  );

  const emailClient = getEmailClient(Resource.RESEND_API_KEY.value);

  const hmacSecretKey = Resource.Keys.hmacSecretKey;
  const githubAppName = Resource.SEMHUB_GITHUB_APP_NAME.value;
  const githubWebhookSecret = Resource.Keys.githubWebhookSecret;
  return {
    db,
    emailClient,
    graphqlOctokit,
    openai,
    restOctokit,
    currStage,
    hmacSecretKey,
    githubAppName,
    githubWebhookSecret,
  };
}
