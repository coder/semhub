import { type ExecutionContext } from "@cloudflare/workers-types";
import { authorizer } from "@openauthjs/openauth";
import { GithubAdapter } from "@openauthjs/openauth/adapter/github";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { Resource } from "sst";

import { tokensetRawSchema } from "@/core/github/schema.oauth";
import { User } from "@/core/user";
import { parseHostname } from "@/core/util/url";

import { getDeps } from "../deps";
import { subjects } from "../subjects";
import {
  allowedDomains,
  getAllowedOrigins,
  githubLogin,
} from "./auth.constant";

export default {
  async fetch(request: Request, ctx: ExecutionContext) {
    console.log("=== Auth Request Debug ===");
    console.log("Request URL:", request.url);
    console.log("Request Method:", request.method);

    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    console.log("Request Origin:", origin);
    console.log("Request Referer:", referer);

    let effectiveOrigin = origin && origin !== "null" ? origin : null;
    if (!effectiveOrigin && referer) {
      try {
        const refererUrl = new URL(referer);
        effectiveOrigin = refererUrl.origin;
        console.log("Extracted origin from referer:", effectiveOrigin);
      } catch (e) {
        console.log("Failed to parse referer:", e);
      }
    }
    effectiveOrigin = effectiveOrigin || "http://localhost:3001";

    console.log("Effective Origin:", effectiveOrigin);

    const allowedOrigins = getAllowedOrigins();
    console.log("Allowed Origins:", allowedOrigins);

    const isAllowedOrigin = allowedOrigins.some((allowed) => {
      if (allowed.includes("*")) {
        const pattern = allowed.replace("*.", ".");
        const matches = effectiveOrigin.endsWith(pattern);
        console.log(
          `Checking pattern ${pattern} against ${effectiveOrigin}: ${matches}`,
        );
        return matches;
      }
      const matches = effectiveOrigin === allowed;
      console.log(
        `Checking exact ${allowed} against ${effectiveOrigin}: ${matches}`,
      );
      return matches;
    });

    console.log("Is Allowed Origin:", isAllowedOrigin);

    // Handle preflight with more permissive headers
    if (request.method === "OPTIONS") {
      console.log("Handling OPTIONS preflight");
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": effectiveOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
          "Access-Control-Expose-Headers": "*",
        },
      });
    }

    const response = await authorizer({
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
        return (
          domain === allowedDomains.prod ||
          domain?.endsWith(`.${allowedDomains.prod}`) ||
          (domain === allowedDomains.dev.host &&
            url.port === allowedDomains.dev.port)
        );
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
            email: primaryEmail,
            userId,
            avatarUrl,
            name,
          });
        }
        throw new Error("Invalid provider");
      },
    }).fetch(request, ctx);

    console.log("=== Response Debug ===");
    console.log("Response Status:", response.status);
    console.log("Original Response Headers:", Object.fromEntries(response.headers));

    // Add CORS headers to response
    const corsHeaders = new Headers(response.headers);
    corsHeaders.set("Access-Control-Allow-Origin", effectiveOrigin);
    corsHeaders.set("Access-Control-Allow-Credentials", "true");
    corsHeaders.set("Access-Control-Expose-Headers", "*");

    const finalResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders,
    });

    console.log("Final Response Headers:", Object.fromEntries(finalResponse.headers));
    return finalResponse;
  },
};
