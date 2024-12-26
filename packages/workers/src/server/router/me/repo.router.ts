import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { and, eq } from "@/core/db";
import { usersToRepos } from "@/core/db/schema/entities/user-to-repo.sql";
import { Github } from "@/core/github";
import { repoValidationSchema } from "@/core/github/schema.validation";
import { Installation } from "@/core/installation";
import { Repo } from "@/core/repo";
import { User } from "@/core/user";
import { getDeps } from "@/deps";
import type { AuthedContext } from "@/server";
import { createSuccessResponse } from "@/server/response";
import { initNextRepos } from "@/wrangler/workflows/sync/repo-init/init.workflow.util";

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
  .get("/preview", zValidator("query", repoValidationSchema), async (c) => {
    const { owner, repo } = c.req.valid("query");
    const { db, restOctokitAppFactory } = getDeps();
    const user = c.get("user");
    const res = await Installation.getValidGithubInstallationIdByRepo({
      userId: user.id,
      repoName: repo,
      repoOwner: owner,
      restOctokitAppFactory,
      db,
    });
    if (!res) {
      throw new HTTPException(404, {
        message: "Installation for specified repo not found",
      });
    }
    const octokit = restOctokitAppFactory(res.githubInstallationId);
    const retrieved = await Github.getRepo({
      repoName: repo,
      repoOwner: owner,
      octokit,
    });
    // highly unlikely to happen, only if race condition between repo name change + subscription
    if (!retrieved.exists) {
      throw new HTTPException(404, {
        message: "GitHub repository not found",
      });
    }
    return c.json(
      createSuccessResponse({
        data: retrieved.data,
        message: "Successfully retrieved repository preview",
      }),
    );
  })
  // Subscribe to a public repository
  .post(
    "/subscribe/public",
    zValidator("json", repoValidationSchema),
    async (c) => {
      const user = c.get("user");
      const { db, restOctokit, emailClient } = getDeps();
      const { owner, repo } = c.req.valid("json");
      // first, check whether repo is already in db, if so, associate with user and return
      const repoExists = await Repo.exists({ owner, name: repo, db: db });
      if (repoExists.exists) {
        const { id, isPrivate } = repoExists;
        if (isPrivate) {
          throw new HTTPException(400, {
            message: "This endpoint is for public repositories only",
          });
        }
        // assumption: since this is a public repo, it has already been initialised
        await User.subscribeRepo({
          repoId: id,
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
      await db.transaction(async (tx) => {
        const createdRepo = await Repo.createRepo({
          data: repoData.data,
          db: tx,
          defaultInitStatus: "ready", // public repo can initialise directly upon creation
        });
        await User.subscribeRepo({
          repoId: createdRepo.id,
          userId: user.id,
          db: tx,
        });
        await initNextRepos(tx, c.env.REPO_INIT_WORKFLOW, emailClient);
      });
      return c.json(createSuccessResponse("Repository created and subscribed"));
    },
  )

  // Subscribe to a private repository
  .post(
    "/subscribe/private",
    zValidator("json", repoValidationSchema),
    async (c) => {
      const user = c.get("user");
      const { db, emailClient, restOctokitAppFactory } = getDeps();
      const { owner, repo } = c.req.valid("json");
      // in theory, should have been validated by preview, but no trust frontend
      const res = await Installation.getValidGithubInstallationIdByRepo({
        userId: user.id,
        repoName: repo,
        repoOwner: owner,
        restOctokitAppFactory,
        db,
      });
      if (!res) {
        throw new HTTPException(404, {
          message: "Installation for specified repo not found",
        });
      }
      const { repoId, repoIsPrivate } = res;
      // for private repos, the repo must already exist in db
      // rather, we need to (1) create the subscription; (2) initialise the repo if it's not already initialised
      if (!repoIsPrivate) {
        throw new HTTPException(400, {
          message: "This endpoint is for private repositories only",
        });
      }
      await db.transaction(async (tx) => {
        await User.subscribeRepo({
          repoId,
          userId: user.id,
          db: tx,
        });
        await Repo.setPrivateRepoToReady(repoId, tx);
        await initNextRepos(tx, c.env.REPO_INIT_WORKFLOW, emailClient);
      });
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
    const { db } = getDeps();

    // Check if user is subscribed to the repo
    const [subscription] = await db
      .select()
      .from(usersToRepos)
      .where(
        and(
          eq(usersToRepos.userId, user.id),
          eq(usersToRepos.repoId, repoId),
          eq(usersToRepos.status, "active"),
        ),
      );

    if (!subscription) {
      throw new HTTPException(404, {
        message: "You are not subscribed to this repository",
      });
    }

    await User.unsubscribeRepo({
      repoId,
      userId: user.id,
      db,
    });

    return c.json(
      createSuccessResponse("Successfully unsubscribed from repository"),
    );
  });
