import { Hono } from "hono";

import type { User } from "@/core/user";
import { getDeps } from "@/deps";
import type { AuthedContext } from "@/server";
import type { ErrorResponse, SuccessResponse } from "@/server/response";

// Mock data for development
const MOCK_REPOS = [
  {
    id: "1",
    ownerName: "facebook",
    name: "react",
    htmlUrl: "https://github.com/facebook/react",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "ready",
    lastSyncedAt: "2024-01-22T10:00:00Z", // recent
    issueLastUpdatedAt: "2024-01-22T22:00:00Z", // more recent
  },
  {
    id: "2",
    ownerName: "vercel",
    name: "next.js",
    htmlUrl: "https://github.com/vercel/next.js",
    isPrivate: true,
    initStatus: "error",
    syncStatus: "error",
    lastSyncedAt: "2024-01-20T15:30:00Z", // few days ago
    issueLastUpdatedAt: "2024-01-19T12:00:00Z", // older
  },
  {
    id: "3",
    ownerName: "microsoft",
    name: "typescript",
    htmlUrl: "https://github.com/microsoft/typescript",
    isPrivate: false,
    initStatus: "in_progress",
    syncStatus: "ready",
    lastSyncedAt: null,
    issueLastUpdatedAt: null,
  },
  {
    id: "4",
    ownerName: "opensearch",
    name: "opensearch",
    htmlUrl: "https://github.com/opensearch/opensearch",
    isPrivate: true,
    initStatus: "ready",
    syncStatus: "ready",
    lastSyncedAt: null,
    issueLastUpdatedAt: null,
  },
  {
    id: "5",
    ownerName: "google",
    name: "golang",
    htmlUrl: "https://github.com/google/golang",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "error",
    lastSyncedAt: "2024-01-21T23:59:59Z",
    issueLastUpdatedAt: "2024-01-21T18:30:00Z",
  },
  {
    id: "6",
    ownerName: "rust-lang",
    name: "rust",
    htmlUrl: "https://github.com/rust-lang/rust",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "in_progress",
    lastSyncedAt: "2024-01-22T11:30:00Z",
    issueLastUpdatedAt: "2024-01-22T11:25:00Z",
  },
  {
    id: "7",
    ownerName: "denoland",
    name: "deno",
    htmlUrl: "https://github.com/denoland/deno",
    isPrivate: false,
    initStatus: "completed",
    syncStatus: "queued",
    lastSyncedAt: "2024-01-22T11:45:00Z",
    issueLastUpdatedAt: "2024-01-22T11:40:00Z",
  },
];

export const repoRouter = new Hono<AuthedContext>()
  // Get all actively subscribed repos for the user
  .get("/list", async (c) => {
    try {
      const user = c.get("user");
      const { db } = getDeps();

      // const subscribedRepos = await User.getSubscribedRepos(user.id, db);

      return c.json<
        SuccessResponse<Awaited<ReturnType<typeof User.getSubscribedRepos>>>
      >({
        success: true,
        message: "Successfully retrieved subscribed repositories",
        data: MOCK_REPOS as any,
      });
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
