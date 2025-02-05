import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";

import type { Context } from "../app";

export const sentryRouter = new Hono<Context>().post("/tunnel", async (c) => {
  try {
    const envelopeBytes = await c.req.arrayBuffer();
    const envelope = new TextDecoder().decode(envelopeBytes);
    const [headerPiece] = envelope.split("\n");
    if (!headerPiece) {
      throw new HTTPException(400, {
        message: "Invalid envelope: missing header",
      });
    }
    const header = JSON.parse(headerPiece);
    if (!header.dsn) {
      throw new HTTPException(400, {
        message: "Invalid envelope: missing DSN",
      });
    }

    // Extract Sentry details from the DSN in the envelope
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace("/", "");
    const sentryHost = dsn.hostname;

    // Construct the upstream Sentry URL
    const upstreamSentryUrl = `https://${sentryHost}/api/${projectId}/envelope/`;

    // Get the original client IP
    const clientIp =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for") ||
      c.req.header("x-real-ip");

    // Forward the envelope to Sentry
    const response = await fetch(upstreamSentryUrl, {
      method: "POST",
      body: envelopeBytes,
      headers: {
        // Forward content type
        "Content-Type":
          c.req.header("content-type") ?? "application/x-sentry-envelope",
        // Forward client information
        "User-Agent": c.req.header("user-agent") ?? "",
        "X-Forwarded-For": clientIp ?? "",
        // Forward other relevant headers that Sentry might use
        "X-Client-IP": clientIp ?? "",
        "X-Real-IP": clientIp ?? "",
        // Forward geolocation data if available from Cloudflare
        "CF-IPCountry": c.req.header("cf-ipcountry") ?? "",
        "CF-Ray": c.req.header("cf-ray") ?? "",
      },
    });

    if (!response.ok) {
      // TODO: properly handle error
      console.error(
        `Sentry forwarding failed: ${response.status} ${response.statusText}`,
      );
      return c.json(
        { error: "Failed to forward to Sentry" },
        response.status as StatusCode,
      );
    }

    // Return the response from Sentry
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    // TODO: properly handle error
    console.error("Error in Sentry tunnel:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    return c.json({ error: "Internal server error" }, 500 as StatusCode);
  }
});
