import { Resource } from "sst";

import { createDb } from "@/core/db";
import { getEmailClient } from "@/core/email";
import { getGraphqlOctokit, getRestOctokit } from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps(withLogging = true) {
  const { db, closeConnection } = createDb({
    connectionString: Resource.DATABASE_URL.value,
    isProd: !withLogging,
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

  return {
    db,
    closeConnection,
    emailClient,
    graphqlOctokit,
    openai,
    restOctokit,
  };
}
