import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { Embedding } from "@/core/embedding";
import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/rate-limiter";

import type { WorkflowRPC } from "../util";
import { chunkArray } from "../util";

interface Env extends WranglerSecrets {
  RATE_LIMITER: Service<RateLimiterWorker>;
  SYNC_REPO_EMBEDDING_WORKFLOW: Workflow;
}

export type EmbeddingParams = {
  issueIds: string[];
  name: string;
};

export class EmbeddingWorkflow extends WorkflowEntrypoint<
  Env,
  EmbeddingParams
> {
  async run(event: WorkflowEvent<EmbeddingParams>, step: WorkflowStep) {
    const { issueIds, name: repoName } = event.payload;
    const { DATABASE_URL, GITHUB_PERSONAL_ACCESS_TOKEN, OPENAI_API_KEY } =
      this.env;
    const { db, openai } = getDeps({
      databaseUrl: DATABASE_URL,
      githubPersonalAccessToken: GITHUB_PERSONAL_ACCESS_TOKEN,
      openaiApiKey: OPENAI_API_KEY,
    });
    const issueIdBatches = await step.do(
      `Preparing issue batches for processing issues of ${repoName}`,
      async () => {
        const BATCH_SIZE = 40;
        return chunkArray(issueIds, BATCH_SIZE);
      },
    );

    for (const [batchIndex, batchIssueIds] of issueIdBatches.entries()) {
      await step.do(
        `Processing batch ${batchIndex + 1}/${issueIdBatches.length}`,
        async () => {
          const selectedIssues = await step.do(
            `selecting issues from db for embedding (batch ${batchIndex + 1}) for ${repoName}`,
            async () => {
              return await Embedding.selectIssuesForEmbedding(
                batchIssueIds,
                db,
              );
            },
          );

          const embeddings = await step.do(
            `create embeddings for selected issues from API for ${repoName}`,
            async () => {
              // TODO: move this out into steps and increase concurrency. pMap 5?
              // TODO: move all chunk size, concurrency limit etc. into a file
              return await Embedding.createEmbeddingsBatch({
                issues: selectedIssues,
                rateLimiter: this.env.RATE_LIMITER,
                openai,
                concurrencyLimit: 20,
              });
            },
          );

          await step.do(
            `update issue embeddings in db for ${repoName}`,
            async () => {
              await Embedding.bulkUpdateIssueEmbeddings(embeddings, db);
            },
          );
        },
      );
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    // Return 400 for direct HTTP requests since workflows should be triggered via bindings
    return Response.json(
      { error: "Workflows must be triggered via bindings" },
      { status: 400 },
    );
  },
  async create(options, env: Env) {
    const { id } = await env.SYNC_REPO_EMBEDDING_WORKFLOW.create(options);
    return id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.SYNC_REPO_EMBEDDING_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.SYNC_REPO_EMBEDDING_WORKFLOW.get(id);
    return await instance.status();
  },
} satisfies WorkflowRPC<EmbeddingParams>;
