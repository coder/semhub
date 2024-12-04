import type { WorkflowStep } from "cloudflare:workers";
import pMap from "p-map";

import { eq, type DbClient } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import type { GraphqlOctokit } from "@/core/github/shared";
import { Repo } from "@/core/repo";

import type { EmbeddingParams } from "./embedding";
import type { WorkflowRPC } from "./util";
import { chunkArray } from "./util";

export const syncRepo = async ({
  repo,
  step,
  db,
  graphqlOctokit,
  mode,
  embeddingWorkflow,
}: {
  repo: Awaited<ReturnType<typeof Repo.getReposForCron>>[number];
  step: WorkflowStep;
  db: DbClient;
  graphqlOctokit: GraphqlOctokit;
  mode: "cron" | "init";
  embeddingWorkflow: WorkflowRPC<EmbeddingParams>;
}) => {
  const { repoId, repoOwner, repoName } = repo;
  const name = `${repoOwner}/${repoName}`;
  const issuesToChunk = await step.do(
    `get issues array to chunk for ${name}`,
    async () => {
      return await Github.getIssuesArrayToChunk({
        repoOwner,
        repoName,
        octokit: graphqlOctokit,
        since: repo.issuesLastUpdatedAt,
      });
    },
  );
  if (issuesToChunk.length === 0) {
    await finalizeSync({ repoId, completedAt: new Date(), db, step });
    return;
  }
  const chunkedIssues = await step.do("chunk issues", async () => {
    // return value max size of 1MiB, chunk issues to extract into batches of 100
    const CHUNK_SIZE = 100;
    return chunkArray(issuesToChunk, CHUNK_SIZE);
  });
  const issueUpdatedCandidates = await step.do(
    `get issues metadata and upsert issues and associated comments and labels for ${name}`,
    async () => {
      const processChunkedIssues = async (
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
          return await processChunkedIssues(issueNumbers, idx);
        },
        { concurrency: 2 },
      );
    },
  );
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
  if (outdatedIssueIds.length === 0) {
    await finalizeSync({ repoId, completedAt: new Date(), db, step });
    return;
  }
  const chunkedIssueIds = await step.do(
    `chunk issues with outdated embeddings for repo ${name}`,
    async () => {
      const CHUNK_SIZE = 200;
      return chunkArray(outdatedIssueIds, CHUNK_SIZE);
    },
  );
  const completedAt = await step.do(
    `process issues with outdated embeddings for repo ${name}`,
    async () => {
      const processIssueIdsStep = async (issueIds: string[], idx: number) => {
        const workflowId = await step.do(
          `launch workflow for issueIds batch ${idx}`,
          async () => {
            // the reason we launch a new workflow is because there is a 1000-subrequest limit per worker
            return await embeddingWorkflow.create({
              params: { issueIds, name },
            });
          },
        );
        while (true) {
          const instanceStatus = await step.do(
            "get workflow status",
            async () => {
              return await embeddingWorkflow.getInstanceStatus(workflowId);
            },
          );
          switch (instanceStatus.status) {
            case "complete":
            case "errored":
            case "terminated":
              return;
            default: {
              await step.sleep(
                "wait for workflow to complete or error out",
                "30 seconds",
              );
            }
          }
        }
      };
      await pMap(
        chunkedIssueIds,
        async (issueIds, idx) => {
          await processIssueIdsStep(
            issueIds.map((b) => b.id),
            idx,
          );
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
  await finalizeSync({ repoId, completedAt, db, step });
};

async function finalizeSync({
  repoId,
  completedAt,
  db,
  step,
}: {
  repoId: string;
  completedAt: Date;
  db: DbClient;
  step: WorkflowStep;
}) {
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
}
