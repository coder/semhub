import { type ExecutionContext } from "@cloudflare/workers-types";
import { authorizer } from "@openauthjs/openauth";
import { GithubAdapter } from "@openauthjs/openauth/adapter/github";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { Resource } from "sst";

import { tokensetRawSchema } from "@/core/github/schema.oauth";
import { User } from "@/core/user";
import { parseHostname } from "@/core/util/url";

import { getDeps } from "./deps";
import { subjects } from "./subjects";

const githubLoginScopes = ["user:email", "read:user"];

export default {
  async fetch(request: Request, ctx: ExecutionContext) {
    return authorizer({
      storage: CloudflareStorage({
        namespace: Resource.AuthKv,
      }),
      subjects,
      providers: {
        github: GithubAdapter({
          clientID: Resource.SEMHUB_GITHUB_APP_CLIENT_ID.value,
          clientSecret: Resource.SEMHUB_GITHUB_APP_CLIENT_SECRET.value,
          scopes: githubLoginScopes,
        }),
        // password: PasswordAdapter(
        //   PasswordUI({
        //     sendCode: async (email, code) => {
        //       console.log(email, code);
        //     },
        //   }),
        // ),
      },
      allow: async (input) => {
        const url = new URL(input.redirectURI);
        const { domain } = parseHostname(url.hostname);
        if (domain === "semhub.dev") return true; // can consider whitelisting specific subdomains
        if (domain === "localhost" || url.port === "3001") return true;
        return false;
      },
      success: async (ctx, value) => {
        if (value.provider === "github") {
          const { data, error, success } = tokensetRawSchema.safeParse(
            value.tokenset.raw,
          );
          if (!success) {
            console.error("something went wrong", error);
            return new Response("something went wrong", { status: 500 });
          }
          const { access_token: accessToken } = data;
          const { db } = getDeps();
          const { email, id } = await User.upsert({
            accessToken,
            db,
            githubScopes: githubLoginScopes,
          });
          return ctx.subject("user", {
            email,
            userId: id,
          });
        }
        throw new Error("Invalid provider");
      },
    }).fetch(request, ctx);
  },
};
