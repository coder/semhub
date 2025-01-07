import { Resource } from "sst";

import { createDb } from "@/core/db";
import { getEmailClient } from "@/core/email";
import {
  createGraphqlOctokitAppFactory,
  createRestOctokitAppFactory,
  getGraphqlOctokit,
  getRestOctokit,
} from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps() {
  const currStage = Resource.App.stage;
  const { db, closeConnection } = createDb({
    connectionString: Resource.DATABASE_URL.value,
    isProd: currStage === "prod",
  });

  const openai = createOpenAIClient(Resource.OPENAI_API_KEY.value);

  const graphqlOctokit = getGraphqlOctokit({
    type: "token",
    token: Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
  });

  const restOctokit = getRestOctokit({
    type: "token",
    token: Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
  });

  const emailClient = getEmailClient(Resource.RESEND_API_KEY.value);
  const githubAppPrivateKey = Resource.SEMHUB_GITHUB_APP_PRIVATE_KEY.value;
  const githubAppId = Resource.SEMHUB_GITHUB_APP_ID.value;
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
    currStage,
    closeConnection,
    emailClient,
    graphqlOctokit,
    openai,
    restOctokit,
    graphqlOctokitAppFactory,
    restOctokitAppFactory,
  };
}
