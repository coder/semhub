import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { User } from "@/core/user";
import { getDeps } from "@/deps";
import type { AuthedContext } from "@/server";
import { createSuccessResponse } from "@/server/response";
import { initNextRepos } from "@/wrangler/workflows/sync/repo-init/init.workflow.util";

import { repoSubscribeSchema } from "../schema/repo.schema";

export const repoRouter = new Hono<AuthedContext>()
  // Get all actively subscribed repos for the user
  .get("/list", async (c) => {
    const user = c.get("user");
    const { db } = getDeps();
    const repos = await Repo.getSubscribedRepos(user.id, db);
    return c.json(
      createSuccessResponse({
        data: repos,
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
      const { db, restOctokit, emailClient } = getDeps();
      const { owner, repo } = c.req.valid("json");
      // first, check whether repo is already in db, if so, associate with user and return
      const repoExists = await Repo.exists({ owner, name: repo, db: db });
      if (repoExists.exists) {
        await User.subscribeRepo({
          repoId: repoExists.id,
          userId: user.id,
          db,
        });
        return c.json(
          createSuccessResponse("Repository exists and user subscribed"),
        );
      }
      // repo does not exist in db
      const repoData = await Github.getRepo({
        repoName: repo,
        repoOwner: owner,
        octokit: restOctokit,
      });
      if (!repoData.exists) {
        throw new HTTPException(404, {
          message: "Repository does not exist on GitHub",
        });
      }
      const createdRepo = await Repo.createRepo(repoData.data, db);
      await User.subscribeRepo({
        repoId: createdRepo.id,
        userId: user.id,
        db,
      });
      await initNextRepos(db, c.env.REPO_INIT_WORKFLOW, emailClient);
      return c.json(createSuccessResponse("Repository created and subscribed"));
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
