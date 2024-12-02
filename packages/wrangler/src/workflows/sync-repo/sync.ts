import type { WorkflowStep } from "cloudflare:workers";
import pMap from "p-map";

import type { DbClient } from "@/core/db";
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
) => {
  const { repoId } = repo;
  await step.do("mark repo as syncing", async () => {
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
    const issuesAndCommentsLabels = await step.do(
      "get issues and associated comments and labels",
      async () => {
        const data = await Github.getIssuesCommentsLabels(repo, graphqlOctokit);
        return data;
      },
    );
    await step.do("upsert issues, comments, and labels", async () => {
      return await Repo.upsertIssuesCommentsLabels(
        { ...issuesAndCommentsLabels, repoId },
        db,
      );
    });
    const issueIds = await step.do(
      "get issues with outdated embeddings",
      async () => {
        return await Embedding.getOutdatedIssues(db);
      },
    );
    // we choose to batch embedding generation and upserting in the same step
    // because if there is intermittent failure, there will still be incremental progress
    // (as opposed to fetching all embeddings in one go and then doing upsert)
    const batchProcessIssues = async (issueId: typeof issueIds) => {
      // Split issueIds into chunks of 10
      const chunks = [];
      for (let i = 0; i < issueId.length; i += 10) {
        chunks.push(issueId.slice(i, i + 10));
      }

      // Process chunks with concurrency of 2
      await pMap(
        chunks,
        async (batch) => {
          await Embedding.createEmbeddingAndUpdateDb(
            {
              issueIds: batch,
              rateLimiter: null, // Adjust if you have a rate limiter
            },
            db,
            openai,
          );
        },
        { concurrency: 2 },
      );
    };
    await batchProcessIssues(issueIds);
  } catch (e) {
    throw e;
  } finally {
    await step.do("mark repo as not syncing", async () => {
      await Repo.updateSyncStatus(
        {
          repoId,
          isSyncing: false,
          successfulSynced: false,
        },
        db,
      );
    });
  }
};
