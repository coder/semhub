import { Hono } from "hono";

import { sendEmail } from "@/core/email";
import { validateGithubWebhook } from "@/core/github/crypto";
import {
  githubWebhookHeaderSchema,
  installationSchema,
} from "@/core/github/schema.webhook";
import { getDeps } from "@/deps";
import type { Context } from "@/server";

import { handleInstallationEvent } from "./github.handler";

export const githubRouter = new Hono<Context>().post("/", async (c) => {
  try {
    const { db, emailClient, currStage, githubWebhookSecret } = getDeps();
    // Validate headers
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const { "x-github-event": eventType, "x-hub-signature-256": signature } =
      githubWebhookHeaderSchema.parse(headers);
    // Get the webhook payload as text for validation
    const payload = await c.req.text();
    // Validate webhook signature
    const isValid = await validateGithubWebhook({
      payload,
      signature,
      secret: githubWebhookSecret,
    });
    if (!isValid) {
      return c.json(
        { success: false, error: "Invalid webhook signature" },
        401,
      );
    }

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
