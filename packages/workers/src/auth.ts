import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resource } from "sst";

import { createDb } from "@/core/db";
import { accounts } from "@/core/db/schema/entities/account.sql";
import { sessions } from "@/core/db/schema/entities/session.sql";
import { users } from "@/core/db/schema/entities/user.sql";
import { verifications } from "@/core/db/schema/entities/verification.sql";

const { db } = createDb({
  connectionString: Resource.Supabase.databaseUrl,
  isProd: false,
});

export const auth = betterAuth({
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
  advanced: {
    generateId: false,
  },
  socialProviders: {
    github: {
      clientId: Resource.SEMHUB_GITHUB_APP_CLIENT_ID.value,
      clientSecret: Resource.SEMHUB_GITHUB_APP_CLIENT_SECRET.value,
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
});
