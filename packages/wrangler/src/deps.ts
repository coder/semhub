import type { WranglerSecretsCamelCase } from "@/core/constants/wrangler";
import { createDb } from "@/core/db";
import { getGraphqlOctokit, getRestOctokit } from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps({
  databaseUrl,
  githubPersonalAccessToken,
  openaiApiKey,
}: WranglerSecretsCamelCase) {
  const { db } = createDb({
    connectionString: databaseUrl,
    isProd: process.env.ENVIRONMENT === "prod",
  });

  const openai = createOpenAIClient(openaiApiKey);
  const graphqlOctokit = getGraphqlOctokit(githubPersonalAccessToken);
  const restOctokit = getRestOctokit(githubPersonalAccessToken);

  return { db, graphqlOctokit, openai, restOctokit };
}
