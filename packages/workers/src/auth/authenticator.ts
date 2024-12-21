import { authorizer } from "@openauthjs/openauth";
import { GithubAdapter } from "@openauthjs/openauth/adapter/github";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Resource } from "sst";

import { tokensetRawSchema } from "@/core/github/schema.oauth";
import { User } from "@/core/user";
import { parseHostname } from "@/core/util/url";

import { getDeps } from "../deps";
import { subjects } from "../subjects";
import { APP_DOMAIN, getAuthServerCORS, githubLogin } from "./auth.constant";

const app = new Hono();

app.use("*", async (c, next) => {
  const { currStage } = getDeps();
  return cors(getAuthServerCORS(currStage))(c, next);
});

app.all("*", async (c) => {
  return authorizer({
    storage: CloudflareStorage({
      namespace: Resource.AuthKv,
    }),
    subjects,
    providers: {
      [githubLogin.provider]: GithubAdapter({
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
        const { userId, primaryEmail } = await User.upsert({
          accessToken,
          db,
          githubScopes: githubLogin.scopes,
        });
        return ctx.subject("user", {
          id: userId,
          email: primaryEmail,
        });
      }
      throw new Error("Invalid provider");
    },
  }).fetch(c.req.raw, c.env);
});

export default app;
