import { Hono } from "hono";

import { User } from "@/core/user";
import { getDeps } from "@/deps";
import type { AuthedContext } from "@/server";
import type { ErrorResponse, SuccessResponse } from "@/server/response";

// Mock data for development
const MOCK_REPOS = [
  {
    id: "1",
    owner: "facebook",
    name: "react",
    htmlUrl: "https://github.com/facebook/react",
    isPrivate: false,
    lastSyncedAt: new Date(),
  },
  {
    id: "2",
    owner: "vercel",
    name: "next.js",
    htmlUrl: "https://github.com/vercel/next.js",
    isPrivate: false,
    lastSyncedAt: new Date(),
  },
  {
    id: "3",
    owner: "microsoft",
    name: "typescript",
    htmlUrl: "https://github.com/microsoft/typescript",
    isPrivate: false,
    lastSyncedAt: new Date(),
  },
];

export const repoRouter = new Hono<AuthedContext>()
  // Get all actively subscribed repos for the user
  .get("/list", async (c) => {
    try {
      const user = c.get("user");
      const { db } = getDeps();

      // const subscribedRepos = await User.getSubscribedRepos(user.id, db);

      // return c.json<SuccessResponse<typeof MOCK_REPOS>>({
      //   success: true,
      //   message: "Successfully retrieved subscribed repositories",
      //   data: MOCK_REPOS,
      // });
      const subscribedRepos: typeof MOCK_REPOS = [];
      return c.json<SuccessResponse<typeof subscribedRepos>>(
        {
          success: true,
          message: "Successfully retrieved subscribed repositories",
          data: subscribedRepos,
        },
        200,
      );
    } catch (error: any) {
      console.error("Error fetching subscribed repositories:", error);
      return c.json<ErrorResponse>({
        success: false,
        error: error.toString(),
      });
    }
  })

  // Subscribe to a public repository
  .post("/subscribe/public", async (c) => {
    const user = c.get("user");
    // TODO: Implement public repository subscription logic
    return c.json<SuccessResponse>({
      success: true,
      message: "Public repository subscription will be implemented",
    });
  })

  // Subscribe to a private repository
  .post("/subscribe/private", async (c) => {
    const user = c.get("user");
    // TODO: Implement private repository subscription logic
    return c.json<SuccessResponse>({
      success: true,
      message: "Private repository subscription will be implemented",
    });
  })

  // Unsubscribe from a repository
  .post("/unsubscribe/:repoId", async (c) => {
    const user = c.get("user");
    const repoId = c.req.param("repoId");
    // TODO: Implement repository unsubscription logic
    return c.json<SuccessResponse>({
      success: true,
      message: "Repository unsubscription will be implemented",
    });
  });
