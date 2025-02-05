import { Hono } from "hono";

import type { Context } from "../app";

export const sentryRouter = new Hono<Context>().post("/tunnel", async (c) => {
  try {
    const sentryUrl = "https://o4508764596142080.ingest.us.sentry.io";
    const envelope = await c.req.arrayBuffer();

    // Forward the envelope to Sentry
    const response = await fetch(
      `${sentryUrl}/api/4508764610494464/envelope/`,
      {
        method: "POST",
        body: envelope,
        headers: {
          // Forward necessary headers
          "Content-Type":
            c.req.header("content-type") ?? "application/x-sentry-envelope",
          // Forward any other relevant headers from the original request
          "User-Agent": c.req.header("user-agent") ?? "",
        },
      },
    );

    if (!response.ok) {
      // Log error but don't expose internal details to client
      console.error(
        `Sentry forwarding failed: ${response.status} ${response.statusText}`,
      );
      return c.json({ error: "Failed to forward to Sentry" }, 500);
    }

    // Return the response from Sentry
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Error in Sentry tunnel:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
