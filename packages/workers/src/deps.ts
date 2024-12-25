import { Resource } from "sst";

import { createDb } from "@/core/db";
import { getEmailClient } from "@/core/email";
import {
  getAppAuthOctokit,
  getGraphqlOctokit,
  getRestOctokit,
} from "@/core/github/shared";
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
  const githubAppPublicLink = Resource.SEMHUB_GITHUB_PUBLIC_LINK.value;
  const githubWebhookSecret = Resource.Keys.githubWebhookSecret;
  const githubAppPrivateKey = Resource.SEMHUB_GITHUB_APP_PRIVATE_KEY.value;
  const githubAppId = Resource.SEMHUB_GITHUB_APP_ID.value;
  const githubAppClientId = Resource.SEMHUB_GITHUB_APP_CLIENT_ID.value;
  const githubAppClientSecret = Resource.SEMHUB_GITHUB_APP_CLIENT_SECRET.value;
  const appAuthOctokit = getAppAuthOctokit({
    githubAppId,
    githubAppPrivateKey,
    githubAppClientId,
    githubAppClientSecret,
  });
  return {
    db,
    emailClient,
    graphqlOctokit,
    openai,
    restOctokit,
    currStage,
    hmacSecretKey,
    githubAppPublicLink,
    appAuthOctokit,
    githubWebhookSecret,
  };
}
