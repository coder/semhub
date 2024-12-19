import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { DbClient } from "@/db";
import { accounts } from "@/db/schema/entities/account.sql";
import { sessions } from "@/db/schema/entities/session.sql";
import { users } from "@/db/schema/entities/user.sql";
import { verifications } from "@/db/schema/entities/verification.sql";

// CORS configuration
export const corsConfig = {
  prod: {
    origins: ["https://semhub.dev"],
  },
  // cannot use wildcard if CORS "credentials: include" is used
  // TODO: need to refactor this if we ever have staging
  dev: {
    origins: ["http://localhost:3001"],
  },
};

export function getBetterAuthConfig({
  db,
  githubClientId,
  githubClientSecret,
  betterAuthSecret,
  // betterAuthBaseUrl,
}: {
  db: DbClient;
  githubClientId: string;
  githubClientSecret: string;
  betterAuthSecret: string;
  // betterAuthBaseUrl: string;
}) {
  return {
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: {
        user: users,
        account: accounts,
        session: sessions,
        verification: verifications,
      },
    }),
    // baseURL: betterAuthBaseUrl,
    secret: betterAuthSecret,
    advanced: {
      generateId: false,
    },
    socialProviders: {
      github: {
        clientId: githubClientId,
        clientSecret: githubClientSecret,
      },
    },
    // secondaryStorage: {
    //   get: async (key: string) => {
    //     return await Resource
    //   },
    //   set: async (key: string, value: string) => {
    //     return await Resource.SecondaryStorage.set(key, value);
    //   },
    //   delete: async (key: string) => {
    //     return await Resource.SecondaryStorage.delete(key);
    //   },
    // },
  } satisfies BetterAuthOptions;
}
