import { createClient } from "@openauthjs/openauth/client";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Resource } from "sst";

import type { Context } from "..";
import { githubLogin } from "../../auth/auth.constant";
import { subjects } from "../../subjects";

export const authRouter = new Hono<Context>()
  .get("/", async (c) => {
    const client = getAuthClient();
    const accessToken = getCookie(c, "access_token");
    const refreshToken = getCookie(c, "refresh_token");

    console.log("typeof client", typeof client);
    console.log("did i reach here");
    const verified = await client.verify(subjects, accessToken || "", {
      refresh: refreshToken || undefined,
    });
    console.log("not here");

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
    console.log("urlorigin", url.origin);
    const redirectURI = `${url.origin}/api/auth/callback`;
    console.log("reached here");
    const authUrl = await client.authorize(redirectURI, "code", {
      pkce: true,
      provider: githubLogin.provider,
    });
    console.log("reached here");
    return c.redirect(authUrl.url);
  })
  .get("/callback", async (c) => {
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
        secure: true,
        sameSite: "Strict",
        path: "/",
        maxAge: 2147483647,
      });
      setCookie(c, "refresh_token", exchanged.tokens.refresh, {
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
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
