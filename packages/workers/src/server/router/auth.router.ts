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
    const { currStage } = getDeps();
    const isLocalDevelopment = currStage !== "prod" && currStage !== "stg";
    try {
      const client = getAuthClient();
      const accessToken = getCookie(c, "access_token");
      const refreshToken = getCookie(c, "refresh_token");

      console.log({ accessToken, refreshToken });
      // If no tokens exist, return unauthorized immediately
      if (!accessToken && !refreshToken) {
        return c.json({
          authenticated: false,
          message: "No tokens",
        } as const);
      }
      console.log("verifying");
      const verified = await client.verify(subjects, accessToken || "", {
        refresh: refreshToken,
      });
      if (verified.err) {
        return c.json({
          authenticated: false,
          error: verified.err.message,
        } as const);
      }

      // Set new tokens if they were refreshed
      if (verified.tokens) {
        setCookie(c, "access_token", verified.tokens.access, {
          httpOnly: true,
          secure: !isLocalDevelopment,
          sameSite: isLocalDevelopment ? "Lax" : "Strict",
          path: "/",
          domain: isLocalDevelopment ? "localhost" : ".semhub.dev",
          maxAge: 60 * 60,
        });
        setCookie(c, "refresh_token", verified.tokens.refresh, {
          httpOnly: true,
          secure: !isLocalDevelopment,
          sameSite: isLocalDevelopment ? "Lax" : "Strict",
          path: "/",
          domain: isLocalDevelopment ? "localhost" : ".semhub.dev",
          maxAge: 14 * 24 * 60 * 60,
        });
      }
      // Return the session data
      return c.json({
        authenticated: true,
        userEmail: verified.subject.properties.email,
      } as const);
    } catch (_error) {
      return c.json(
        {
          authenticated: false,
          error: "Server error",
        } as const,
        500,
      );
    }
  })
  .get("/authorize", async (c) => {
    const client = getAuthClient();
    const url = new URL(c.req.url);
    const returnTo = c.req.query("returnTo") || "/";
    const redirectURI = `${url.origin}/api/auth/callback`;
    try {
      const authUrl = await client.authorize(redirectURI, "code").then((v) => {
        const finalUrl = new URL(v.url);
        finalUrl.searchParams.set("state", encodeURIComponent(returnTo));
        return finalUrl.toString();
      });
      return c.json({ url: authUrl });
    } catch (e: any) {
      console.error("Error authorizing", e.toString());
      return c.text("Error authorizing", e.toString());
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
      const state = c.req.query("state");
      const returnTo = state ? decodeURIComponent(state) : "/";

      if (!code) throw new Error("No code provided");
      const exchanged = await client.exchange(code, redirectURI);
      if (exchanged.err) throw new Error("Invalid code");
      setCookie(c, "access_token", exchanged.tokens.access, {
        httpOnly: true,
        secure: !isLocalDevelopment,
        sameSite: isLocalDevelopment ? "Lax" : "Strict",
        path: "/",
        domain: isLocalDevelopment ? "localhost" : ".semhub.dev",
        maxAge: 60 * 60,
      });
      setCookie(c, "refresh_token", exchanged.tokens.refresh, {
        httpOnly: true,
        secure: !isLocalDevelopment,
        sameSite: isLocalDevelopment ? "Lax" : "Strict",
        path: "/",
        domain: isLocalDevelopment ? "localhost" : ".semhub.dev",
        maxAge: 14 * 24 * 60 * 60,
      });
      return c.redirect(returnTo);
    } catch (e: any) {
      console.error("Error authorizing", e.toString());
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
  });
}
