import { betterAuth } from "better-auth";
import { Resource } from "sst";

import { getBetterAuthConfig } from "@/auth/config";
import { createDb } from "@/db";

const { db } = createDb({
  // @ts-ignore Resource will be available during CLI runtime
  connectionString: Resource.Supabase.databaseUrl,
  isProd: false,
});
// this only works in CLI
export const auth = betterAuth(
  getBetterAuthConfig({
    db,
    // @ts-ignore Resource will be available during CLI runtime
    githubClientId: Resource.SEMHUB_GITHUB_APP_CLIENT_ID.value,
    // @ts-ignore Resource will be available during CLI runtime
    githubClientSecret: Resource.SEMHUB_GITHUB_APP_CLIENT_SECRET.value,
    // @ts-ignore Resource will be available during CLI runtime
    betterAuthSecret: Resource.BETTER_AUTH_SECRET.value,
  }),
);
