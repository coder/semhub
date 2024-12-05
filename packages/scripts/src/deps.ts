import { Resource } from "sst";

import { createDb } from "@/core/db";
import { getGraphqlOctokit, getRestOctokit } from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

export function getDeps() {
  const { db } = createDb({
    connectionString: Resource.Supabase.databaseUrl,
    isProd: Resource.App.stage === "prod",
  });

  const openai = createOpenAIClient(Resource.OPENAI_API_KEY.value);

  const graphqlOctokit = getGraphqlOctokit(
    Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
  );

  const restOctokit = getRestOctokit(
    Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
  );

  return { db, graphqlOctokit, openai, restOctokit };
}
