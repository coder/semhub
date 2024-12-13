import type { WranglerSecrets } from "@/core/constants/wrangler.constant";
import { createDb } from "@/core/db";
import { getEmailClient } from "@/core/email";
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
  const emailClient = getEmailClient(secrets.RESEND_API_KEY);

  return { db, emailClient, graphqlOctokit, openai, restOctokit };
}
