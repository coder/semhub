import { Hono } from "hono";

import { sendEmail } from "@/core/email";
import {
  githubWebhookHeaderSchema,
  installationSchema,
} from "@/core/github/schema.webhook";
import { getDeps } from "@/deps";
import type { Context } from "@/server";

import { handleInstallationEvent } from "./github.handler";

export const githubRouter = new Hono<Context>().post("/", async (c) => {
  try {
    const { db, emailClient, currStage } = getDeps();
    // Validate headers
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const { "x-github-event": eventType } =
      githubWebhookHeaderSchema.parse(headers);

    // Get the webhook payload
    const payload = await c.req.json();

    // Handle different event types
    switch (eventType) {
      case "installation": {
        const data = installationSchema.parse(payload);
        await handleInstallationEvent(
          db,
          emailClient,
          data,
          c.env.INSTALLATION_WORKFLOW,
        );
        break;
      }
      // Add other event types as needed
      default: {
        await sendEmail(
          {
            to: "warren@coder.com",
            subject: `Unhandled webhook event type`,
            html: `<p>Unhandled webhook event type: ${eventType}</p>`,
          },
          emailClient,
          currStage,
        );
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error processing GitHub webhook:", error);
    return c.json({ success: false, error: "Failed to process webhook" }, 500);
  }
});
