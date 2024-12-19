import { createClient } from "@openauthjs/openauth/client";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Resource } from "sst";

import { getDeps } from "@/deps";

import type { Context } from "..";
import { githubLogin } from "../../auth/auth.constant";
import { subjects } from "../../subjects";

export const authRouter = new Hono<Context>()
  .get("/", async (c) => {
    const client = getAuthClient();
    const accessToken = getCookie(c, "access_token");
    const refreshToken = getCookie(c, "refresh_token");

    const verified = await client.verify(subjects, accessToken || "", {
      refresh: refreshToken,
    });

    if (verified.err) {
      return c.redirect(`${c.req.url}/authorize`);
    }

    const response = c.json(verified.subject);
    if (verified.tokens) {
      setCookie(c, "access_token", verified.tokens.access, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        path: "/",
        maxAge: 2147483647,
      });
      setCookie(c, "refresh_token", verified.tokens.refresh, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        path: "/",
        maxAge: 2147483647,
      });
    }
    return response;
  })
  .get("/authorize", async (c) => {
    const client = getAuthClient();
    const url = new URL(c.req.url);
    const redirectURI = `${url.origin}/api/auth/callback`;
    try {
      const authUrl = await client
        .authorize(redirectURI, "code")
        .then((v) => v.url);
      console.log("authUrl", authUrl);
      return c.json({ url: authUrl });
    } catch (e) {
      console.error("Error authorizing", e);
      return c.text("Error authorizing");
    }
  })
  .get("/callback", async (c) => {
    const { currStage } = getDeps();
    const isLocalDevelopment = currStage !== "prod" && currStage !== "stg";
    const client = getAuthClient();
    try {
      const url = new URL(c.req.url);
      const redirectURI = `${url.origin}/api/auth/callback`;
      const code = c.req.query("code");
      if (!code) throw new Error("No code provided");

      const exchanged = await client.exchange(code, redirectURI);
      if (exchanged.err) throw new Error("Invalid code");

      const response = c.redirect("/");
      setCookie(c, "access_token", exchanged.tokens.access, {
        httpOnly: true,
        secure: !isLocalDevelopment,
        sameSite: isLocalDevelopment ? "Lax" : "Strict",
        path: "/",
        maxAge: 2147483647,
      });
      setCookie(c, "refresh_token", exchanged.tokens.refresh, {
        httpOnly: true,
        secure: !isLocalDevelopment,
        sameSite: isLocalDevelopment ? "Lax" : "Strict",
        path: "/",
        maxAge: 2147483647,
      });
      return response;
    } catch (e: any) {
      return c.text(e.toString());
    }
  })
  .get("/logout", (c) => {
    deleteCookie(c, "access_token", { path: "/" });
    deleteCookie(c, "refresh_token", { path: "/" });
    return c.redirect("/");
  });

function getAuthClient() {
  return createClient({
    issuer: Resource.Auth.url,
    clientID: githubLogin.provider,
    fetch: (input, init) => Resource.AuthAuthenticator.fetch(input, init),
  });
}
