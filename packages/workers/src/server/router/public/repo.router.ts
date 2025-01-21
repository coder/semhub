import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { DbClient } from "@/core/db";
import { getGithubRepo, getGitHubRepoIssueStats } from "@/core/github";
import { repoUserInputSchema } from "@/core/github/schema.validation";
import type { RestOctokit } from "@/core/github/shared";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { CacheKey, withCache } from "@/server/kv";
import { createSuccessResponse } from "@/server/response";
import { repoIssueCountsSchema } from "@/server/router/schema/repo.schema";

export const repoRouter = new Hono<Context>().get(
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
      const createdRepo = await Repo.createRepo({
        data,
        db,
        defaultInitStatus: "ready", // public repo can initialise directly upon creation
      });
      owner = createdRepo.repoOwner;
      repo = createdRepo.repoName;
      repoStatus = {
        id: createdRepo.id,
        initStatus: createdRepo.initStatus,
        syncStatus: createdRepo.syncStatus,
        issuesLastUpdatedAt: createdRepo.issuesLastUpdatedAt,
        lastSyncedAt: createdRepo.lastSyncedAt,
        avatarUrl: createdRepo.avatarUrl,
        repoName: repo,
        repoOwner: owner,
      };
    }
    switch (repoStatus.initStatus) {
      case "in_progress": {
        const [repoIssueCounts, syncedIssuesCount] = await Promise.all([
          getRepoIssueCounts(owner, repo, restOctokit),
          getSyncedIssuesCount(owner, repo, repoStatus.id, db),
        ]);
        const repoStatusWithCounts = {
          ...repoStatus,
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
      case "ready":
      case "completed":
      case "error":
      case "no_issues":
      case "pending": {
        const repoStatusNew = {
          ...repoStatus,
          initStatus: repoStatus.initStatus,
          repoIssueCounts: null,
          syncedIssuesCount: null,
        } as const;
        return c.json(
          createSuccessResponse({
            data: repoStatusNew,
            message: "Successfully retrieved repository status without counts",
          }),
        );
      }
    }
  },
);

async function getRepoIssueCounts(
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

async function getSyncedIssuesCount(
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
