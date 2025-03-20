import { issuer } from "@openauthjs/openauth";
import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Resource } from "sst";

import { APP_DOMAIN } from "@/core/constants/domain.constant";
import { tokensetRawSchema } from "@/core/github/schema.oauth";
import { User } from "@/core/user";
import { parseHostname } from "@/core/util/url";

import { getDeps } from "../deps";
import { getAuthServerCORS, githubLogin } from "./auth.constant";
import { subjects } from "./subjects";

const app = new Hono();

app.use("*", async (c, next) => {
  return cors(getAuthServerCORS())(c, next);
});

app.all("*", async (c) => {
  return issuer({
    storage: CloudflareStorage({
      namespace: Resource.AuthKv,
    }),
    subjects,
    providers: {
      [githubLogin.provider]: GithubProvider({
        clientID: Resource.SEMHUB_GITHUB_APP_CLIENT_ID.value,
        clientSecret: Resource.SEMHUB_GITHUB_APP_CLIENT_SECRET.value,
        scopes: githubLogin.scopes,
      }),
    },
    allow: async (input) => {
      const url = new URL(input.redirectURI);
      const { domain } = parseHostname(url.hostname);
      return domain === APP_DOMAIN;
    },
    success: async (ctx, value) => {
      if (value.provider === githubLogin.provider) {
        const data = tokensetRawSchema.parse(value.tokenset.raw);
        const { access_token: accessToken } = data;
        const { db } = getDeps();
        const { userId, primaryEmail, avatarUrl, name } = await User.upsert({
          accessToken,
          db,
          githubScopes: githubLogin.scopes,
        });
        return ctx.subject("user", {
          id: userId,
          email: primaryEmail,
          avatarUrl,
          name,
        });
      }
      throw new Error("Invalid provider");
    },
  }).fetch(c.req.raw, c.env);
});

export default app;
