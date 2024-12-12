import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import pMap from "p-map";

import type { WranglerSecrets } from "@/core/constants/wrangler.constant";
import { eq, inArray } from "@/core/db";
import { issueTable } from "@/core/db/schema/entities/issue.sql";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Embedding } from "@/core/embedding";
import { getDeps } from "@/deps";
import {
  BATCH_SIZE_PER_EMBEDDING_CHUNK,
  NUM_ISSUES_TO_EMBED_PER_CRON,
} from "@/workflows/sync/sync.param";
import { chunkArray, type WorkflowRPC } from "@/workflows/workflow.util";

interface Env extends WranglerSecrets {
  SYNC_EMBEDDING_WORKFLOW: Workflow;
}

/* two modes
1. as part of repo init. takes an array of issueIds (100 at a time), calls DB, creates embeddings, update DB
2. as part of cron sync. no parameter. just query all out-of-sync issueIds 100 at a time, create embeddings, update DB, calls itself recursively until no more such issues are found
*/
export type EmbeddingParams =
  | {
      mode: "init";
      issueIds: string[];
      repoName: string;
      repoId: string;
    }
  | {
      mode: "cron";
    };

export class EmbeddingWorkflow extends WorkflowEntrypoint<
  Env,
  EmbeddingParams
> {
  async run(event: WorkflowEvent<EmbeddingParams>, step: WorkflowStep) {
    const { mode } = event.payload;
    const { db, openai } = getDeps(this.env);
    const issuesToEmbed = await step.do(
      `get issues to embed from db (${mode})`,
      async () => {
        return mode === "init"
          ? await Embedding.selectIssuesForEmbeddingInit(
              event.payload.issueIds,
              db,
            )
          : await Embedding.selectIssuesForEmbeddingCron(
              db,
              NUM_ISSUES_TO_EMBED_PER_CRON,
            );
      },
    );
    if (issuesToEmbed.length === 0) {
      return;
    }
    try {
      const chunkedIssues = chunkArray(
        issuesToEmbed,
        BATCH_SIZE_PER_EMBEDDING_CHUNK,
      );
      const batchEmbedIssues = async (
        issues: typeof issuesToEmbed,
        idx: number,
      ): Promise<void> => {
        const embeddings = await step.do(
          `create embeddings for selected issues from API (batch ${idx + 1})`,
          async () => {
            return await Embedding.createEmbeddings({
              issues,
              rateLimiter: null,
              openai,
            });
          },
        );
        await step.do(
          `update issue embeddings in db (batch ${idx + 1})`,
          async () => {
            await Embedding.bulkUpdateIssueEmbeddings(embeddings, db);
          },
        );
      };
      await pMap(chunkedIssues, async (issues, idx) => {
        return await batchEmbedIssues(issues, idx);
      });
    } catch (e) {
      if (mode === "init") {
        const { repoId, repoName } = event.payload;
        await step.do(
          `sync unsuccessful, mark repo ${repoName} init status to error`,
          async () => {
            // TODO: ideally, also log this error/send an email to me or sth
            await db
              .update(repos)
              // this prevents the repo from being re-init again
              .set({ initStatus: "error" })
              .where(eq(repos.id, repoId));
          },
        );
      }
      if (mode === "cron") {
        // TODO: ideally, also log this error/send an email to me or sth
        await db
          .update(issueTable)
          .set({ embeddingSyncStatus: "error" })
          .where(
            inArray(
              issueTable.id,
              // a little overinclusive...
              issuesToEmbed.map((i) => i.id),
            ),
          );
      }
      throw e;
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
    const { id } = await env.SYNC_EMBEDDING_WORKFLOW.create(options);
    return id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.SYNC_EMBEDDING_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.SYNC_EMBEDDING_WORKFLOW.get(id);
    return await instance.status();
  },
} satisfies WorkflowRPC<EmbeddingParams>;
