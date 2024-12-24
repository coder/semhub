import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { createHmacDigest, verifyHmacDigest } from "@/core/util/crypto";
import { getDeps } from "@/deps";
import type { Context } from "@/server";

import { createSuccessResponse } from "../response";

export const authzRouter = new Hono<Context>()
  .get("/authorize", async (c) => {
    const { hmacSecretKey, githubAppName } = getDeps();
    const returnTo = c.req.query("returnTo") || "/";
    // Generate a UUID for challenge state
    const challengeState = crypto.randomUUID();
    // Store challengeState in KV to prevent replay
    await Resource.AuthKv.put(`authz:challenge ${challengeState}`, "1", {
      expirationTtl: 10 * 60, // 10 minutes
    });
    // Sign the returnTo URL
    const signature = await createHmacDigest({
      secretKey: hmacSecretKey,
      data: `${challengeState}:${returnTo}`,
    });
    const state = `${signature}.${challengeState}:${returnTo}`;

    const url = `https://github.com/apps/${githubAppName}/installations/new?state=${encodeURIComponent(state)}`;

    return c.json(
      createSuccessResponse({
        data: { url },
        message: "Successfully generated GitHub App installation URL",
      }),
    );
  })
  .get("/callback", async (c) => {
    const { hmacSecretKey } = getDeps();
    try {
      const state = c.req.query("state");
      const installation_id = c.req.query("installation_id");

      if (!state) {
        throw new HTTPException(400, { message: "No state provided" });
      }

      // Split into signature and data
      const [signature, ...dataParts] = decodeURIComponent(state).split(".");
      const data = dataParts.join("."); // rejoin in case data contains dots
      if (!signature || !data) {
        throw new HTTPException(400, { message: "Invalid state format" });
      }

      // Split data into challengeState and returnTo parts
      const [challengeState, ...returnToParts] = data.split(":");
      const returnTo = returnToParts.join(":"); // rejoin returnTo parts that might contain ":"
      if (!challengeState || !returnTo) {
        throw new HTTPException(400, { message: "Invalid state data" });
      }

      // retrieve and delete challengeState from KV to prevent replay
      const challengeStateFromKV = await Resource.AuthKv.get(
        `authz:challenge ${challengeState}`,
      );
      if (!challengeStateFromKV) {
        throw new HTTPException(400, { message: "Challenge state not found" });
      }
      await Resource.AuthKv.delete(`authz:challenge ${challengeState}`);

      // Verify the signature
      const isValid = await verifyHmacDigest({
        secretKey: hmacSecretKey,
        data: `${challengeState}:${returnTo}`,
        digest: signature,
      });
      if (!isValid) {
        throw new HTTPException(400, { message: "Invalid state signature" });
      }

      if (!installation_id) {
        throw new HTTPException(400, {
          message: "No installation ID provided",
        });
      }

      // TODO: Store the installation_id in the database if needed
      // For now, just redirect back
      return c.redirect(returnTo);
    } catch (e: any) {
      console.error(
        "Error handling GitHub App installation callback",
        e.toString(),
      );
      return c.text(e.toString());
    }
  });
