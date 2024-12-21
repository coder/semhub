import { createClient } from "@openauthjs/openauth/client";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { githubLogin } from "@/auth/auth.constant";
import { subjects } from "@/subjects";

import type { Context } from "..";

export const authMiddleware: MiddlewareHandler<Context> = async (c, next) => {
  const accessToken = getCookie(c, "access_token");
  const refreshToken = getCookie(c, "refresh_token");

  if (!accessToken && !refreshToken) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  try {
    const client = createClient({
      issuer: Resource.Auth.url,
      clientID: githubLogin.provider,
    });

    const verified = await client.verify(subjects, accessToken || "", {
      refresh: refreshToken,
    });

    if (verified.err) {
      throw new HTTPException(401, { message: verified.err.message });
    }

    const user =
      verified.subject.type === "user" ? verified.subject.properties : null;
    if (!user) {
      throw new HTTPException(401, {
        message: "Something went wrong in verified.subject.type",
      });
    }
    // Store the verified user in context for later use
    c.set("user", user);
    await next();
  } catch (_error: any) {
    throw new HTTPException(401, { message: "Authentication failed" });
  }
};
