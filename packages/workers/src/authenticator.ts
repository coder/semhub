import {
  type ExecutionContext,
  type KVNamespace,
} from "@cloudflare/workers-types";
import { authorizer } from "@openauthjs/openauth";
// import { GithubAdapter } from "@openauthjs/openauth/adapter/github";
import { PasswordAdapter } from "@openauthjs/openauth/adapter/password";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { PasswordUI } from "@openauthjs/openauth/ui/password";

import { eq } from "@/core/db";
import { users } from "@/core/db/schema/entities/user.sql";

import { getDeps } from "./deps";
import { subjects } from "./subjects";

interface Env {
  CloudflareAuthKV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return authorizer({
      storage: CloudflareStorage({
        namespace: env.CloudflareAuthKV,
      }),
      subjects,
      providers: {
        // github: GithubAdapter({
        //   clientID: "123",
        //   clientSecret: "123",
        //   scopes: ["user:email"],
        // }),
        password: PasswordAdapter(
          PasswordUI({
            sendCode: async (email, code) => {
              console.log(email, code);
            },
          }),
        ),
      },
      success: async (ctx, value) => {
        if (value.provider === "password") {
          const email = value.email;
          const { db } = getDeps();
          const [user] = await db
            .select({
              id: users.id,
              email: users.email,
            })
            .from(users)
            .where(eq(users.email, email));
          if (!user) {
            throw new Error("User not found");
          }
          return ctx.subject("user", {
            email: value.email,
            userId: user.id,
          });
        }
        throw new Error("Invalid provider");
      },
    }).fetch(request, env, ctx);
  },
};
