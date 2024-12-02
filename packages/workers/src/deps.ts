import { Resource } from "sst";

import { createDb } from "@/core/db";
import { getGraphqlOctokit, getRestOctokit } from "@/core/github/shared";
import { createOpenAIClient } from "@/core/openai";

const dbConfig = {
  connectionString: Resource.Supabase.databaseUrl,
  isProd: Resource.App.stage === "prod",
};
const { db } = createDb(dbConfig);

const openai = createOpenAIClient(Resource.OPENAI_API_KEY.value);

const graphqlOctokit = getGraphqlOctokit(
  Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value,
);

const restOctokit = getRestOctokit(Resource.GITHUB_PERSONAL_ACCESS_TOKEN.value);

export { db, graphqlOctokit, openai, restOctokit };
