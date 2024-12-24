import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { AuthedContext } from "@/server";
import { createSuccessResponse } from "@/server/response";

import { repoSubscribeSchema } from "../schema/repo.schema";
import { MOCK_REPOS } from "./repo.router.test";

export const repoRouter = new Hono<AuthedContext>()
  // Get all actively subscribed repos for the user
  .get("/list", async (c) => {
    const user = c.get("user");
    const { db } = getDeps();

    type SubscribedRepo = Awaited<ReturnType<typeof Repo.getSubscribedRepos>>;
    return c.json(
      createSuccessResponse({
        data: MOCK_REPOS as SubscribedRepo,
        message: "Successfully retrieved subscribed repositories",
      }),
    );
  })

  // Subscribe to a public repository
  .post(
    "/subscribe/public",
    zValidator("json", repoSubscribeSchema),
    async (c) => {
      const user = c.get("user");
      const { owner, repo } = c.req.valid("json");
      // TODO: Implement public repository subscription logic
      return c.json(
        createSuccessResponse(
          "Public repository subscription will be implemented",
        ),
      );
    },
  )

  // Subscribe to a private repository
  .post(
    "/subscribe/private",
    zValidator("json", repoSubscribeSchema),
    async (c) => {
      const user = c.get("user");
      const { owner, repo } = c.req.valid("json");
      // TODO: Implement private repository subscription logic
      return c.json(
        createSuccessResponse(
          "Private repository subscription will be implemented",
        ),
      );
    },
  )

  // Unsubscribe from a repository
  .post("/unsubscribe/:repoId", async (c) => {
    const user = c.get("user");
    const repoId = c.req.param("repoId");
    // TODO: Implement repository unsubscription logic
    return c.json(
      createSuccessResponse("Repository unsubscription will be implemented"),
    );
  });
