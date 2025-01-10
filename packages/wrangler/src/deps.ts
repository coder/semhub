import type { WranglerSecrets } from "@/core/constants/wrangler.constant";
import { createDb } from "@/core/db";
import { getEmailClient } from "@/core/email";
import {
  createGraphqlOctokitAppFactory,
  createRestOctokitAppFactory,
  getGraphqlOctokit,
  getRestOctokit,
} from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps(secrets: WranglerSecrets) {
  const { db } = createDb({
    connectionString: secrets.DATABASE_URL,
    useLogger: process.env.ENVIRONMENT !== "prod",
    options: {
      connect_timeout: 10000, // 10 seconds
      connection: {
        statement_timeout: 60000, // 60 seconds
      },
    },
  });

  const openai = createOpenAIClient(secrets.OPENAI_API_KEY);
  const graphqlOctokit = getGraphqlOctokit({
    type: "token",
    token: secrets.GITHUB_PERSONAL_ACCESS_TOKEN,
  });
  const restOctokit = getRestOctokit({
    type: "token",
    token: secrets.GITHUB_PERSONAL_ACCESS_TOKEN,
  });
  const emailClient = getEmailClient(secrets.RESEND_API_KEY);
  const githubAppId = secrets.SEMHUB_GITHUB_APP_ID;
  const githubAppPrivateKey = secrets.SEMHUB_GITHUB_APP_PRIVATE_KEY;
  const graphqlOctokitAppFactory = createGraphqlOctokitAppFactory(
    githubAppId,
    githubAppPrivateKey,
  );
  const restOctokitAppFactory = createRestOctokitAppFactory(
    githubAppId,
    githubAppPrivateKey,
  );

  return {
    db,
    emailClient,
    graphqlOctokit,
    openai,
    restOctokit,
    graphqlOctokitAppFactory,
    restOctokitAppFactory,
  };
}
