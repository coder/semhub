import type { WorkflowStep } from "cloudflare:workers";
import pMap from "p-map";

import type { RateLimiter } from "@/core/constants/rate-limit";
import { eq, type DbClient } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import type { GraphqlOctokit } from "@/core/github/shared";
import type { OpenAIClient } from "@/core/openai";
import { Repo } from "@/core/repo";

export const syncRepo = async (
  repo: Awaited<ReturnType<typeof Repo.getReposForCron>>[number],
  step: WorkflowStep,
  db: DbClient,
  graphqlOctokit: GraphqlOctokit,
  openai: OpenAIClient,
  mode: "cron" | "init",
  rateLimiter: RateLimiter | null,
) => {
  const { repoId, repoOwner, repoName } = repo;
  const name = `${repoOwner}/${repoName}`;
  await step.do("sync started, mark repo as syncing", async () => {
    await Repo.updateSyncStatus(
      {
        repoId,
        isSyncing: true,
      },
      db,
    );
  });
  // use try catch so that in failure, we will mark repo as not syncing
  try {
    const issues = await step.do("get all issues to process", async () => {
      return await Github.getAllIssuesToProcess({
        repoOwner,
        repoName,
        octokit: graphqlOctokit,
      });
    });
    const chunkedIssues = await step.do("chunk issues", async () => {
      // return value max size of 1MiB, chunk issues to extract into batches of 100
      const chunks = [];
      for (let i = 0; i < issues.length; i += 100) {
        chunks.push(issues.slice(i, i + 100));
      }
      return chunks;
    });
    const issueUpdatedCandidates = await step.do(
      `get issues metadata and upsert issues and associated comments and labels for chunk no. ${name}`,
      async () => {
        const processIssues = async (
          issueNumbers: (typeof chunkedIssues)[number],
          idx: number,
        ) => {
          const { issuesAndCommentsLabels, lastIssueUpdatedAt } = await step.do(
            `get issues and associated comments and labels for batch ${idx}`,
            async () => {
              return await Github.getIssuesCommentsLabels({
                issueNumbers,
                repoId,
                repoName,
                repoOwner,
                octokit: graphqlOctokit,
              });
            },
          );
          await step.do("upsert issues, comments, and labels", async () => {
            return await Repo.upsertIssuesCommentsLabels(
              issuesAndCommentsLabels,
              db,
            );
          });
          return lastIssueUpdatedAt;
        };
        return await pMap(
          chunkedIssues,
          async (issueNumbers, idx) => {
            return await processIssues(issueNumbers, idx);
          },
          { concurrency: 2 },
        );
      },
    );
    // get biggest last issue updated at
    const lastIssueUpdatedAt = await step.do(
      "get biggest last issue updated at",
      async () => {
        return issueUpdatedCandidates
          .filter((date): date is Date => date !== null)
          .reduce((a, b) => (a > b ? a : b));
      },
    );

    if (mode === "cron") {
      // can set this once issues have been inserted; no need to wait for embeddings
      // search may be slightly outdated, but it's fine + it's tracked in issues table
      await step.do(
        `update repo.issuesLastUpdatedAt for cron repo ${name}`,
        async () => {
          await db
            .update(repos)
            .set({
              issuesLastUpdatedAt: lastIssueUpdatedAt,
            })
            .where(eq(repos.id, repoId));
        },
      );
    }
    const outdatedIssueIds = await step.do(
      `get issues with outdated embeddings for repo ${name}`,
      async () => {
        return await Embedding.getOutdatedIssues(db, repoId);
      },
    );
    const chunkedIssueIds = await step.do(
      `chunk issues with outdated embeddings for repo ${name}`,
      async () => {
        // Split issueIds into chunks of 10
        const chunks = [];
        for (let i = 0; i < outdatedIssueIds.length; i += 10) {
          chunks.push(outdatedIssueIds.slice(i, i + 10));
        }
        return chunks;
      },
    );
    const completedAt = await step.do(
      `process issues with outdated embeddings for repo ${name}`,
      async () => {
        const processIssueIdsStep = async (
          issueIds: typeof outdatedIssueIds,
          idx: number,
        ) => {
          // we choose to batch embedding generation and upserting in the same step
          // because if there is intermittent failure, there will still be incremental progress
          // (as opposed to fetching all embeddings in one go and then doing upsert)
          await step.do(`process issue ids: batch ${idx}`, async () => {
            await Embedding.txGetEmbAndUpdateDb(
              {
                issueIds,
                rateLimiter,
              },
              db,
              openai,
            );
          });
        };
        await pMap(
          chunkedIssueIds,
          async (issueIds, idx) => {
            await processIssueIdsStep(issueIds, idx);
          },
          { concurrency: 2 },
        );
        return new Date();
      },
    );
    if (mode === "init") {
      // for init, only update this when embeddings are synced. this prevents users from searching before embeddings are synced and getting no results
      await step.do(
        "update repo.issuesLastUpdatedAt for initialized repo",
        async () => {
          await db
            .update(repos)
            .set({
              issuesLastUpdatedAt: lastIssueUpdatedAt,
            })
            .where(eq(repos.id, repoId));
        },
      );
    }
    await step.do("sync successful, mark repo as not syncing", async () => {
      await Repo.updateSyncStatus(
        {
          repoId,
          isSyncing: false,
          successfulSynced: true,
          syncedAt: completedAt,
        },
        db,
      );
    });
  } catch (e) {
    await step.do("sync failed, mark repo as not syncing", async () => {
      await Repo.updateSyncStatus(
        {
          repoId,
          isSyncing: false,
          successfulSynced: false,
        },
        db,
      );
    });
    throw e;
  }
};
