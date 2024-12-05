import type { WorkflowStep } from "cloudflare:workers";
import pMap from "p-map";

import type { DbClient } from "@/core/db";
import { Embedding } from "@/core/embedding";

import { type EmbeddingParams } from "./embedding";
import type { WorkflowRPC } from "./util";
import { chunkArray } from "./util";

async function waitForWorkflowCompletion(
  step: WorkflowStep,
  workflowId: string,
  embeddingWorkflow: WorkflowRPC<EmbeddingParams>,
) {
  while (true) {
    const instanceStatus = await step.do("get workflow status", async () => {
      return await embeddingWorkflow.getInstanceStatus(workflowId);
    });

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
}

async function processEmbeddingBatches({
  step,
  chunkedIssueIds,
  embeddingWorkflow,
  name,
}: {
  step: WorkflowStep;
  chunkedIssueIds: string[][];
  embeddingWorkflow: WorkflowRPC<EmbeddingParams>;
  name: string;
}) {
  await pMap(
    chunkedIssueIds,
    async (batchIssueIds, idx) => {
      const workflowId = await step.do(
        `launch workflow for batch ${idx}`,
        async () => {
          return await embeddingWorkflow.create({
            params: { issueIds: batchIssueIds, name },
          });
        },
      );

      await waitForWorkflowCompletion(step, workflowId, embeddingWorkflow);
    },
    // TODO: extract constants
    { concurrency: 2 },
  );
}

export async function processRepoEmbeddings({
  step,
  db,
  embeddingWorkflow,
  repoId,
  name,
}: {
  step: WorkflowStep;
  db: DbClient;
  embeddingWorkflow: WorkflowRPC<EmbeddingParams>;
  repoId: string;
  name: string;
}) {
  // TODO: extract constants
  const BATCH_SIZE = 10000;
  let processedCount = 0;

  while (true) {
    const outdatedIssueIds = await step.do(
      `get issues with outdated embeddings for repo ${name} (offset: ${processedCount})`,
      async () => {
        return await Embedding.getRepoOutdatedIssues(db, repoId, {
          limit: BATCH_SIZE,
          offset: processedCount,
        });
      },
    );

    if (outdatedIssueIds.length === 0) break;

    // TODO: extract constants
    const CHUNK_SIZE = 200;
    const chunkedIssueIds = chunkArray(
      outdatedIssueIds.map((i) => i.id),
      CHUNK_SIZE,
    );

    await step.do(
      `process embeddings for repo ${name} (batch ${processedCount}-${processedCount + outdatedIssueIds.length})`,
      {
        retries: {
          limit: 1,
          delay: 10000,
          backoff: "linear",
        },
        // TODO: extract constants
        // arbitrary number, to tune later
        timeout: "90 minutes",
      },
      async () => {
        await processEmbeddingBatches({
          step,
          chunkedIssueIds,
          embeddingWorkflow,
          name,
        });
      },
    );

    processedCount += outdatedIssueIds.length;
  }
}

export async function processCronEmbeddings({
  step,
  db,
  embeddingWorkflow,
}: {
  step: WorkflowStep;
  db: DbClient;
  embeddingWorkflow: WorkflowRPC<EmbeddingParams>;
}) {
  const outdatedIssueIds = await step.do(
    "get all outdated embeddings across repos",
    async () => {
      return await Embedding.getAllOutdatedIssuesFromNonSyncingRepos(db);
    },
  );
  if (outdatedIssueIds.length === 0) return;

  const chunkedIssueIds = chunkArray(
    outdatedIssueIds.map((i) => i.id),
    // TODO: extract constants
    200,
  );

  await step.do(`process cron embeddings`, async () => {
    await processEmbeddingBatches({
      step,
      chunkedIssueIds,
      embeddingWorkflow,
      name: "cron",
    });
  });
}
