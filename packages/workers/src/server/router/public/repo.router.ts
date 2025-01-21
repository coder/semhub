import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { DbClient } from "@/core/db";
import { getGithubRepo, getGitHubRepoIssueStats } from "@/core/github";
import { repoValidationSchema } from "@/core/github/schema.validation";
import type { RestOctokit } from "@/core/github/shared";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { CacheKey, withCache } from "@/server/kv";
import { createSuccessResponse } from "@/server/response";
import { repoIssueCountsSchema } from "@/server/router/schema/repo.schema";

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
        id: createdRepo.id,
        initStatus: createdRepo.initStatus,
        syncStatus: createdRepo.syncStatus,
        issuesLastUpdatedAt: createdRepo.issuesLastUpdatedAt,
        lastSyncedAt: createdRepo.lastSyncedAt,
        avatarUrl: createdRepo.avatarUrl,
      };
    }
    // Run queries in parallel
    const [repoIssueCounts, syncedIssuesCount] = await Promise.all([
      getRepoIssueCounts(owner, repo, restOctokit),
      getSyncedIssuesCount(owner, repo, res.id, db),
    ]);

    return c.json(
      createSuccessResponse({
        data: {
          exists: true,
          data: res,
          repoIssueCounts,
          syncedIssuesCount,
        },
        message: "Successfully retrieved repository status",
      }),
    );
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
