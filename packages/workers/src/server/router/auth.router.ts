import { createClient } from "@openauthjs/openauth/client";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { createHmacDigest, verifyHmacDigest } from "@/core/util/crypto";
import { getCookieOptions, githubLogin } from "@/auth/auth.constant";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";

import { subjects } from "../../auth/subjects";
import { createSuccessResponse } from "../response";

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
          success: true,
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
            success: true,
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
      const user =
        verified.subject.type === "user" ? verified.subject.properties : null;
      if (!user) {
        return c.json(
          {
            success: true,
            authenticated: false,
            message: "No user",
          } as const,
          401,
        );
      }
      return c.json({
        success: true,
        authenticated: true,
        user,
      } as const);
    } catch (error: unknown) {
      console.error(
        "Error authorizing",
        error instanceof Error ? error.message : String(error),
      );
      return c.json(
        {
          success: false,
          authenticated: false,
          message: "Server error",
        } as const,
        500,
      );
    }
  })
  // used in OAuth
  .get("/authorize", async (c) => {
    const { hmacSecretKey } = getDeps();
    const client = getAuthClient();
    const rawUrl = new URL(c.req.url);
    const returnTo = c.req.query("returnTo") || "/";
    const redirectURI = `${rawUrl.origin}/api/auth/callback`;
    const {
      // challengeState is a UUID
      challenge: { state: challengeState },
      url: authUrl,
    } = await client.authorize(redirectURI, "code");

    // store challengeState in KV to prevent replay
    await Resource.AuthKv.put(`oauth:challenge ${challengeState}`, "1", {
      expirationTtl: 60, // in seconds
    });
    // Sign the returnTo URL directly
    const signature = await createHmacDigest({
      secretKey: hmacSecretKey,
      data: `${challengeState}:${returnTo}`,
    });
    const state = `${signature}.${challengeState}:${returnTo}`;
    const newUrl = new URL(authUrl);
    // this overrides the state in the authResponse.url, but it's OK
    // since the signature + the returnTo ensures the same
    newUrl.searchParams.set("state", encodeURIComponent(state));
    return c.json(
      createSuccessResponse({
        data: { url: newUrl.toString() },
        message: "Successfully started authentication",
      }),
    );
  })
  // used in OAuth
  .get("/callback", async (c) => {
    const { hmacSecretKey, currStage } = getDeps();
    const client = getAuthClient();
    try {
      const url = new URL(c.req.url);
      const redirectURI = `${url.origin}/api/auth/callback`;
      const code = c.req.query("code");
      const state = c.req.query("state");

      if (!state)
        throw new HTTPException(400, { message: "No state provided" });

      // Split into signature and data
      const [signature, ...dataParts] = decodeURIComponent(state).split(".");
      const data = dataParts.join("."); // rejoin in case data contains dots
      if (!signature || !data)
        throw new HTTPException(400, { message: "Invalid state format" });

      // Split data into challengeState and returnTo parts
      const [challengeState, ...returnToParts] = data.split(":");
      const returnTo = returnToParts.join(":"); // rejoin returnTo parts that might contain ":"
      if (!challengeState || !returnTo)
        throw new HTTPException(400, { message: "Invalid state data" });

      // retrieve and delete challengeState from KV to prevent replay
      const challengeStateFromKV = await Resource.AuthKv.get(
        `oauth:challenge ${challengeState}`,
      );
      if (!challengeStateFromKV)
        throw new HTTPException(400, { message: "Challenge state not found" });
      await Resource.AuthKv.delete(`oauth:challenge ${challengeState}`);
      // Verify the signature
      const isValid = await verifyHmacDigest({
        secretKey: hmacSecretKey,
        data: `${challengeState}:${returnTo}`,
        digest: signature,
      });
      if (!isValid)
        throw new HTTPException(400, { message: "Invalid state signature" });
      if (!code) throw new HTTPException(400, { message: "No code provided" });
      const exchanged = await client.exchange(code, redirectURI);
      if (exchanged.err)
        throw new HTTPException(400, { message: "Invalid code" });
      const cookieOptions = getCookieOptions(currStage);
      setCookie(c, "access_token", exchanged.tokens.access, cookieOptions);
      setCookie(c, "refresh_token", exchanged.tokens.refresh, cookieOptions);
      return c.redirect(returnTo);
    } catch (error: unknown) {
      console.error(
        "Error authorizing",
        error instanceof Error ? error.message : String(error),
      );
      return c.text(error instanceof Error ? error.message : String(error));
    }
  })
  .post("/logout", (c) => {
    const { currStage } = getDeps();
    deleteCookie(c, "access_token", getCookieOptions(currStage));
    deleteCookie(c, "refresh_token", getCookieOptions(currStage));
    return c.json(createSuccessResponse("Successfully logged out"));
  });

function getAuthClient() {
  return createClient({
    issuer: Resource.Auth.url,
    clientID: githubLogin.provider,
  });
}
