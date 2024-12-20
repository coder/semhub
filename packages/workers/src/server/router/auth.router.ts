import { createClient } from "@openauthjs/openauth/client";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Resource } from "sst";

import { createHmacDigest, verifyHmacDigest } from "@/core/util/crypto";
import { getDeps } from "@/deps";

import type { Context } from "..";
import { getCookieOptions, githubLogin } from "../../auth/auth.constant";
import { subjects } from "../../subjects";

export const authRouter = new Hono<Context>()
  // slightly idiosyncratic implementation to get session data on frontend
  .get("/", async (c) => {
    const { currStage } = getDeps();
    try {
      const client = getAuthClient();
      const accessToken = getCookie(c, "access_token");
      const refreshToken = getCookie(c, "refresh_token");

      // If no tokens exist, return unauthorized immediately
      if (!accessToken && !refreshToken) {
        return c.json({
          authenticated: false,
          message: "No tokens",
        } as const);
      }
      const verified = await client.verify(subjects, accessToken || "", {
        refresh: refreshToken,
      });
      if (verified.err) {
        return c.json(
          {
            authenticated: false,
            message: verified.err.message,
          } as const,
          401,
        );
      }
      verified.subject;

      // Set new tokens if they were refreshed
      if (verified.tokens) {
        setCookie(
          c,
          "access_token",
          verified.tokens.access,
          getCookieOptions(currStage),
        );
        setCookie(
          c,
          "refresh_token",
          verified.tokens.refresh,
          getCookieOptions(currStage),
        );
      }
      // Return the session data
      return c.json({
        authenticated: true,
        user:
          verified.subject.type === "user" ? verified.subject.properties : null,
      } as const);
    } catch (_error) {
      return c.json(
        {
          authenticated: false,
          message: "Server error",
        } as const,
        500,
      );
    }
  })
  // used in OAuth
  .get("/authorize", async (c) => {
    const { signingSecret } = getDeps();
    const client = getAuthClient();
    const url = new URL(c.req.url);
    const returnTo = c.req.query("returnTo") || "/"; // TODO: send user back to frontend on "/"
    const redirectURI = `${url.origin}/api/auth/callback`;
    try {
      const {
        // challengeState is a UUID
        challenge: { state: challengeState },
        url: authUrl,
      } = await client.authorize(redirectURI, "code");

      // Sign the returnTo URL directly
      const signature = await createHmacDigest({
        secret: signingSecret,
        data: `${challengeState}:${returnTo}`,
      });
      const state = `${signature}.${challengeState}:${returnTo}`;
      const url = new URL(authUrl);
      // this overrides the state in the authResponse.url, but it's OK
      // since the signature + the returnTo ensures the same
      url.searchParams.set("state", encodeURIComponent(state));
      return c.json({ authUrl: url.toString() });
    } catch (e: any) {
      console.error("Error authorizing", e.toString());
      return c.text("Error authorizing", e.toString());
    }
  })
  // used in OAuth
  .get("/callback", async (c) => {
    const { signingSecret, currStage } = getDeps();
    const client = getAuthClient();
    try {
      const url = new URL(c.req.url);
      const redirectURI = `${url.origin}/api/auth/callback`;
      const code = c.req.query("code");
      const state = c.req.query("state");

      if (!state) throw new Error("No state provided");

      // Split into signature and data
      const [signature, ...dataParts] = decodeURIComponent(state).split(".");
      const data = dataParts.join("."); // rejoin in case data contains dots
      if (!signature || !data) throw new Error("Invalid state format");

      // Split data into challengeState and returnTo parts
      const [challengeState, ...returnToParts] = data.split(":");
      const returnTo = returnToParts.join(":"); // rejoin returnTo parts that might contain ":"
      if (!challengeState || !returnTo) throw new Error("Invalid state data");

      // Verify the signature
      const isValid = await verifyHmacDigest({
        secret: signingSecret,
        data: `${challengeState}:${returnTo}`,
        digest: signature,
      });
      if (!isValid) throw new Error("Invalid state signature");
      if (!code) throw new Error("No code provided");
      const exchanged = await client.exchange(code, redirectURI);
      if (exchanged.err) throw new Error("Invalid code");
      setCookie(
        c,
        "access_token",
        exchanged.tokens.access,
        getCookieOptions(currStage),
      );
      setCookie(
        c,
        "refresh_token",
        exchanged.tokens.refresh,
        getCookieOptions(currStage),
      );
      return c.redirect(returnTo);
    } catch (e: any) {
      console.error("Error authorizing", e.toString());
      return c.text(e.toString());
    }
  })
  .get("/logout", (c) => {
    const { currStage } = getDeps();
    const returnTo = c.req.query("returnTo") || "/";
    deleteCookie(c, "access_token", getCookieOptions(currStage));
    deleteCookie(c, "refresh_token", getCookieOptions(currStage));
    return c.redirect(returnTo);
  });

function getAuthClient() {
  return createClient({
    issuer: Resource.Auth.url,
    clientID: githubLogin.provider,
  });
}
