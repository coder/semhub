import { z } from "zod";

// see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#using-the-web-application-flow-to-generate-a-user-access-token
export const tokensetRawSchema = z.object({
  scope: z.string(), // always an empty string for GitHub Apps; user access token is limited to the permissions that both your app and the user have
  access_token: z.string(),
  token_type: z.literal("bearer"),
  // we have configured the GitHub App to opt out of user-to-server token expiration
  // making the fields below undefined and the access token long-lived
  // expires_in: z.number(),
  // refresh_token: z.string(),
  // refresh_token_expires_in: z.number(),
});
