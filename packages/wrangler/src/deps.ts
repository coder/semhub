import type { WranglerSecrets } from "@/core/constants/wrangler.constant";
import { createDb } from "@/core/db";
import { getGraphqlOctokit, getRestOctokit } from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps(secrets: WranglerSecrets) {
  const { db } = createDb({
    connectionString: secrets.DATABASE_URL,
    isProd: process.env.ENVIRONMENT === "prod",
  });

  const openai = createOpenAIClient(secrets.OPENAI_API_KEY);
  const graphqlOctokit = getGraphqlOctokit(
    secrets.GITHUB_PERSONAL_ACCESS_TOKEN,
  );
  const restOctokit = getRestOctokit(secrets.GITHUB_PERSONAL_ACCESS_TOKEN);

  return { db, graphqlOctokit, openai, restOctokit };
}
