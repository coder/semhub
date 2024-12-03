import { createDb } from "@/core/db";
import { getGraphqlOctokit, getRestOctokit } from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps({
  databaseUrl,
  githubPersonalAccessToken,
  openaiApiKey,
}: {
  databaseUrl: string;
  githubPersonalAccessToken: string;
  openaiApiKey: string;
}) {
  const { db } = createDb({
    connectionString: databaseUrl,
    isProd: false,
  });

  const openai = createOpenAIClient(openaiApiKey);
  const graphqlOctokit = getGraphqlOctokit(githubPersonalAccessToken);
  const restOctokit = getRestOctokit(githubPersonalAccessToken);

  return { db, graphqlOctokit, openai, restOctokit };
}
