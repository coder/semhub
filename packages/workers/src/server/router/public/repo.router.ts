import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { getGithubRepo } from "@/core/github";
import { repoValidationSchema } from "@/core/github/schema.validation";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { createSuccessResponse } from "@/server/response";

export const repoRouter = new Hono<Context>().get(
  "/:owner/:repo/status",
  zValidator("param", repoValidationSchema),
  async (c) => {
    const { owner, repo } = c.req.valid("param");
    const { db, restOctokit } = getDeps();
    let res = await Repo.readyForPublicSearch({
      owner,
      name: repo,
      db,
    });
    // if res is null, we trigger the sync
    // doing state change on GET, but we are gangsta that way
    if (!res) {
      const { exists, data } = await getGithubRepo({
        repoName: repo,
        repoOwner: owner,
        octokit: restOctokit,
      });
      if (!exists) {
        return c.json(
          createSuccessResponse({
            data: {
              exists: false,
            },
            message: "Repository does not exist on GitHub",
          }),
        );
      }
      const createdRepo = await Repo.createRepo({
        data,
        db,
        defaultInitStatus: "ready", // public repo can initialise directly upon creation
      });
      res = {
        initStatus: createdRepo.initStatus,
        syncStatus: createdRepo.syncStatus,
        issuesLastUpdatedAt: createdRepo.issuesLastUpdatedAt,
        lastSyncedAt: createdRepo.lastSyncedAt,
        avatarUrl: createdRepo.avatarUrl,
      };
    }
    // get total count from GitHub API, store in KV, use this to construct progress bar
    return c.json(
      createSuccessResponse({
        data: {
          exists: true,
          data: res,
        },
        message: "Successfully retrieved repository status",
      }),
    );
  },
);
