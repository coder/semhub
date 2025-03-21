import { zValidator } from "@hono/zod-validator";
import { initNextRepos } from "@semhub/wrangler/workflows/sync/repo-init/init.workflow.util";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { DbClient } from "@/core/db";
import { convertSyncCursor } from "@/core/db/schema/entities/repo.sql";
import { getGithubRepo, getGitHubRepoIssueStats } from "@/core/github";
import { repoUserInputSchema } from "@/core/github/schema.validation";
import type { RestOctokit } from "@/core/github/shared";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { CacheKey, withCache } from "@/server/kv";
import { createSuccessResponse } from "@/server/response";
import { repoIssueCountsSchema } from "@/server/router/schema/repo.schema";

export const repoRouter = new Hono<Context>()
  .get(
    "/:owner/:repo/status",
    zValidator("param", repoUserInputSchema),
    async (c) => {
      let { owner, repo } = c.req.valid("param");
      const { db, restOctokit } = getDeps();
      let repoStatus = await Repo.readyForPublicSearch({
        owner,
        name: repo,
        db,
      });
      // if res is null, we trigger the sync
      // doing state change on GET, but we are gangsta that way
      if (!repoStatus) {
        const { exists, data } = await getGithubRepo({
          repoName: repo,
          repoOwner: owner,
          octokit: restOctokit,
        });
        if (!exists) {
          throw new HTTPException(404, {
            message: "Repository does not exist on GitHub",
          });
        }
        const createdRepo = await Repo.create({
          data,
          db,
          defaultInitStatus: "ready", // public repo can initialise directly upon creation
        });
        owner = createdRepo.repoOwner;
        repo = createdRepo.repoName;
        const repoSyncCursor = convertSyncCursor(createdRepo.repoSyncCursor);
        repoStatus = {
          id: createdRepo.id,
          initStatus: createdRepo.initStatus,
          syncStatus: createdRepo.syncStatus,
          issuesLastUpdatedAt: repoSyncCursor?.since ?? null,
          lastSyncedAt: createdRepo.lastSyncedAt,
          avatarUrl: createdRepo.avatarUrl,
          repoName: repo,
          repoOwner: owner,
        };
        // try to trigger init workflow immediately
        await initNextRepos(db, c.env.REPO_INIT_WORKFLOW);
      }
      switch (repoStatus.initStatus) {
        case "in_progress": {
          const [repoIssueCounts, syncedIssuesCount] = await Promise.all([
            getCachedRepoIssueCounts(owner, repo, restOctokit),
            getCachedSyncedIssuesCount(owner, repo, repoStatus.id, db),
          ]);
          const repoStatusWithCounts = {
            ...repoStatus,
            id: undefined,
            initStatus: "in_progress",
            repoIssueCounts,
            syncedIssuesCount,
          } as const;
          return c.json(
            createSuccessResponse({
              data: repoStatusWithCounts,
              message: "Successfully retrieved repository status with counts",
            }),
          );
        }
        case "ready": {
          const repoInitQueuePosition = await Repo.getInitQueuePosition(
            repoStatus.id,
            db,
          );
          const repoStatusNew = {
            ...repoStatus,
            id: undefined,
            initStatus: repoStatus.initStatus,
            repoInitQueuePosition,
          } as const;
          return c.json(
            createSuccessResponse({
              data: repoStatusNew,
              message:
                "Successfully retrieved repository status with queue position",
            }),
          );
        }
        case "completed":
        case "error":
        case "no_issues":
        case "pending": {
          const repoStatusNew = {
            ...repoStatus,
            id: undefined,
            initStatus: repoStatus.initStatus,
          } as const;
          return c.json(
            createSuccessResponse({
              data: repoStatusNew,
              message: "Successfully retrieved repository status",
            }),
          );
        }
      }
    },
  )
  .get("/:owner/:repo", zValidator("param", repoUserInputSchema), async (c) => {
    const { owner, repo } = c.req.valid("param");
    const { db, restOctokit } = getDeps();
    const repoExists = await Repo.exists({ owner, name: repo, db });
    if (repoExists.exists) {
      const { isPrivate } = repoExists;
      if (isPrivate) {
        return c.json(
          createSuccessResponse({
            data: {
              exists: false,
            } as const,
            message: "Repository does not exist",
          }),
        );
      }
      return c.json(
        createSuccessResponse({
          data: {
            exists: true,
            hasLoaded: true,
            initStatus: repoExists.initStatus,
          } as const,
          message: "Repository exists in our database",
        }),
      );
    }
    // repo does not exist
    const repoData = await getGithubRepo({
      repoName: repo,
      repoOwner: owner,
      octokit: restOctokit,
    });
    if (!repoData.exists) {
      return c.json(
        createSuccessResponse({
          data: {
            exists: false,
          } as const,
          message: "Repository does not exist",
        }),
      );
    }
    return c.json(
      createSuccessResponse({
        data: {
          exists: true,
          hasLoaded: false,
        } as const,
        message: "Repository is on GitHub but not in our database",
      }),
    );
  });

async function getCachedRepoIssueCounts(
  owner: string,
  repo: string,
  restOctokit: RestOctokit,
) {
  return withCache({
    key: CacheKey.repoIssueCounts(owner, repo),
    schema: repoIssueCountsSchema,
    options: { expirationTtl: 20 * 60 }, // 20 mins cache
    fetch: async () => {
      const { allIssuesCount, closedIssuesCount, openIssuesCount } =
        await getGitHubRepoIssueStats({
          org: owner,
          repo,
          octokit: restOctokit,
        });
      return {
        allIssuesCount,
        closedIssuesCount,
        openIssuesCount,
      };
    },
  });
}

async function getCachedSyncedIssuesCount(
  owner: string,
  repo: string,
  repoId: string,
  db: DbClient,
) {
  return withCache({
    key: CacheKey.repoSyncedIssues(owner, repo),
    schema: z.coerce.number(),
    options: { expirationTtl: 60 }, // 1 minute cache
    fetch: () => Repo.getSyncedIssuesCount(repoId, db),
  });
}
