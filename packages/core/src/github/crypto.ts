import { verifyHmacDigest } from "../util/crypto";

/**
 * Validates the GitHub webhook signature against the payload using the webhook secret
 * See https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export async function validateGithubWebhook({
  payload,
  signature,
  secret,
}: {
  payload: string;
  signature: string;
  secret: string;
}): Promise<boolean> {
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const digest = signature.substring("sha256=".length);
  return verifyHmacDigest({
    secretKey: secret,
    data: payload,
    digest,
  });
}
