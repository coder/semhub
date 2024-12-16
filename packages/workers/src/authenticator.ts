import { type ExecutionContext } from "@cloudflare/workers-types";
import { authorizer } from "@openauthjs/openauth";
import { GithubAdapter } from "@openauthjs/openauth/adapter/github";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { Resource } from "sst";

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
      success: async (ctx, value) => {
        if (value.provider === "github") {
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
