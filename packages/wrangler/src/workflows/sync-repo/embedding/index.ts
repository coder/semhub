import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { Embedding } from "@/core/embedding";
import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/rate-limiter";

import type { WorkflowWithTypedParams } from "../util";
import { chunkArray } from "../util";

interface Env extends WranglerSecrets {
  RATE_LIMITER: Service<RateLimiterWorker>;
  SYNC_REPO_EMBEDDING_WORKFLOW: WorkflowWithTypedParams<EmbeddingParams>;
}

export type EmbeddingParams = {
  issueIds: string[];
};

export class EmbeddingWorkflow extends WorkflowEntrypoint<
  Env,
  EmbeddingParams
> {
  async run(event: WorkflowEvent<EmbeddingParams>, step: WorkflowStep) {
    const { issueIds } = event.payload;
    const { DATABASE_URL, GITHUB_PERSONAL_ACCESS_TOKEN, OPENAI_API_KEY } =
      this.env;
    const { db, openai } = getDeps({
      databaseUrl: DATABASE_URL,
      githubPersonalAccessToken: GITHUB_PERSONAL_ACCESS_TOKEN,
      openaiApiKey: OPENAI_API_KEY,
    });
    const issueIdBatches = await step.do(
      "Preparing issue batches for processing",
      async () => {
        const BATCH_SIZE = 25;
        return chunkArray(issueIds, BATCH_SIZE);
      },
    );

    for (const [batchIndex, batchIssueIds] of issueIdBatches.entries()) {
      await step.do(
        `Processing batch ${batchIndex + 1}/${issueIdBatches.length}`,
        async () => {
          const selectedIssues = await step.do(
            `selecting issues from db for embedding (batch ${batchIndex + 1})`,
            async () => {
              return await Embedding.selectIssuesForEmbedding(
                batchIssueIds,
                db,
              );
            },
          );

          const embeddings = await step.do(
            `create embeddings for selected issues from API`,
            async () => {
              return await Embedding.createEmbeddingsBatch(
                selectedIssues,
                this.env.RATE_LIMITER,
                openai,
              );
            },
          );

          await step.do(`update issue embeddings in db`, async () => {
            await Embedding.bulkUpdateIssueEmbeddings(embeddings, db);
          });
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
  async create({ params }: { params: EmbeddingParams }, env: Env) {
    await env.SYNC_REPO_EMBEDDING_WORKFLOW.create({ params });
  },
};
