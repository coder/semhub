import { eq } from "drizzle-orm";
import type { Resend } from "resend";

import type { DbClient } from "@/core/db";
import { users } from "@/core/db/schema/entities/user.sql";
import { sendEmail } from "@/core/email";
import type { GithubAppAuthorizationWebhook } from "@/core/github/schema.webhook";
import { getDeps } from "@/deps";

export async function handleGithubAppAuthorizationEvent(
  db: DbClient,
  client: Resend,
  data: GithubAppAuthorizationWebhook,
) {
  const { currStage } = getDeps();
  const { action, sender } = data;
  if (sender.type !== "User") {
    await sendEmail(
      {
        to: "warren@coder.com",
        subject: `Unhandled github_app_authorization event sender type`,
        html: `<p>Unhandled webhook event type: ${JSON.stringify(data)}</p>`,
      },
      client,
      currStage,
    );
  }

  switch (action) {
    case "revoked": {
      // Update user record to mark auth as revoked
      await db
        .update(users)
        .set({
          authRevokedAt: new Date(),
        })
        .where(eq(users.nodeId, sender.node_id));
      break;
    }
    default:
      action satisfies never;
  }
}
