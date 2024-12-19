import { betterAuth } from "better-auth";
import { Resource } from "sst";

import { getBetterAuthConfig } from "@/core/auth/config";
import { createDb } from "@/core/db";
import { getEmailClient } from "@/core/email";
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

  const emailClient = getEmailClient(Resource.RESEND_API_KEY.value);

  const auth = betterAuth(
    getBetterAuthConfig({
      db,
      githubClientId: Resource.SEMHUB_GITHUB_APP_CLIENT_ID.value,
      githubClientSecret: Resource.SEMHUB_GITHUB_APP_CLIENT_SECRET.value,
    }),
  );
  return { auth, db, emailClient, graphqlOctokit, openai, restOctokit };
}
