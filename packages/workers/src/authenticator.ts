import { type ExecutionContext } from "@cloudflare/workers-types";
import { authorizer } from "@openauthjs/openauth";
import { GithubAdapter } from "@openauthjs/openauth/adapter/github";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { Resource } from "sst";

import { githubUserEmailsSchema } from "@/core/github/schema";
import { parseHostname } from "@/core/util/url";

import { subjects } from "./subjects";

export default {
  async fetch(request: Request, ctx: ExecutionContext) {
    return authorizer({
      // storage: MemoryStorage({
      //   persist: "/tmp/openauth.json",
      // }),
      storage: CloudflareStorage({
        namespace: Resource.AuthKv,
      }),
      subjects,
      providers: {
        github: GithubAdapter({
          clientID: Resource.SEMHUB_GITHUB_APP_CLIENT_ID.value,
          clientSecret: Resource.SEMHUB_GITHUB_APP_CLIENT_SECRET.value,
          scopes: ["user:email"],
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
        if (domain === "semhub.dev" || domain === "localhost") return true;
        // in the future, can consider whitelisting specific subdomains or ports
        return false;
      },
      success: async (ctx, value) => {
        if (value.provider === "github") {
          const { access } = value.tokenset;
          const response = await fetch("https://api.github.com/user/emails", {
            headers: {
              Authorization: `token ${access}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          const emails = githubUserEmailsSchema.parse(await response.json());
          const primary = emails.find((email) => email.primary);
          console.log(primary);
          if (!primary || !primary.verified) {
            throw new Error("Email not verified");
          }
          const email = primary.email;
          // const email = value.tokenset.;
          console.log(value.tokenset.access);
          // const { db } = getDeps();
          // const [user] = await db
          //   .select({
          //     id: users.id,
          //     email: users.email,
          //   })
          //   .from(users)
          //   .where(eq(users.email, email));
          // if (!user) {
          //   throw new Error("User not found");
          // }
          // return ctx.subject("user", {
          //   email: value.email,
          //   userId: user.id,
          // });
          console.log(JSON.stringify(value, null, 2));
          return ctx.subject("user", {
            email: "test@test.com",
            userId: "1",
          });
        }
        throw new Error("Invalid provider");
      },
    }).fetch(request, ctx);
  },
};
