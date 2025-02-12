import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import pMap from "p-map";

import type { WranglerEnv } from "@/core/constants/wrangler.constant";
import { eq, inArray } from "@/core/db";
import { issueEmbeddings } from "@/core/db/schema/entities/issue-embedding.sql";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { sendEmail } from "@/core/email";
import {
  createEmbeddings,
  selectIssuesForEmbeddingCron,
  selectIssuesForEmbeddingInit,
  upsertIssueEmbeddings,
} from "@/core/embedding";
import {
  bulkUpdateIssueSummaries,
  generateBodySummary,
  generateCommentsSummary,
  generateOverallSummary,
} from "@/core/summary";
import { chunkArray } from "@/core/util/truncate";
import { getDeps } from "@/deps";
import { getEnvPrefix } from "@/util";
import {
  BATCH_SIZE_PER_EMBEDDING_CHUNK,
  NUM_ISSUES_TO_EMBED_PER_CRON,
} from "@/workflows/sync/sync.param";
import { getStepDuration } from "@/workflows/workflow.param";
import { type WorkflowRPC } from "@/workflows/workflow.util";

import { generateSyncWorkflowId } from "../sync.util";

interface Env extends WranglerEnv {
  SYNC_EMBEDDING_WORKFLOW: Workflow;
}

/* two modes
1. as part of repo init. takes an array of issueIds (100 at a time), calls DB, creates embeddings and generate summaries, update DB
2. as part of cron sync. no parameter. just query all out-of-sync issueIds 100 at a time, create embeddings and generate summaries, update DB
calls itself recursively until no more such issues are found
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
    const { db, dbSession, openai, emailClient } = getDeps(this.env);
    const issuesToEmbed = await step.do(
      `get issues to embed from db (${mode})`,
      getStepDuration("short"),
      async () => {
        return mode === "init"
          ? await selectIssuesForEmbeddingInit(event.payload.issueIds, db)
          : await selectIssuesForEmbeddingCron({
              db,
              numIssues: NUM_ISSUES_TO_EMBED_PER_CRON,
              intervalInHours: 12,
            });
      },
    );
    const completedEmbedding = issuesToEmbed.length === 0;
    await step.do(
      completedEmbedding
        ? "no issues to embed, exit"
        : "issues to embed, continue",
      async () => {
        return;
      },
    );
    if (completedEmbedding) {
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
        totalBatches: number,
      ): Promise<void> => {
        // Generate both summaries in parallel
        const [bodySummaries, commentSummaries] = await Promise.all([
          step.do(
            `generate body summaries for selected issues (batch ${idx + 1} of ${totalBatches})`,
            getStepDuration("long"),
            async () => {
              return await Promise.all(
                issues.map(async (issue) => ({
                  issueId: issue.id,
                  bodySummary:
                    issue.body.length > 1000
                      ? await generateBodySummary(issue.body, openai)
                      : issue.body,
                })),
              );
            },
          ),
          step.do(
            `generate comment summaries for selected issues (batch ${idx + 1} of ${totalBatches})`,
            getStepDuration("long"),
            async () => {
              return await Promise.all(
                issues.map(async (issue) => ({
                  issueId: issue.id,
                  commentsSummary:
                    issue.comments.length === 0
                      ? null
                      : issue.comments.reduce((acc, c) => acc + c.body, "")
                            .length > 1000
                        ? await generateCommentsSummary(issue.comments, openai)
                        : issue.comments
                            .map(
                              (c) =>
                                `${c.author?.name ?? "Deleted User"}: ${c.body}`,
                            )
                            .join("\n"),
                })),
              );
            },
          ),
        ]);

        const overallSummaries = await step.do(
          `generate overall summaries (batch ${idx + 1} of ${totalBatches})`,
          getStepDuration("long"),
          async () => {
            return await Promise.all(
              issues.map(async (issue) => {
                const bodySummary = bodySummaries.find(
                  (s) => s.issueId === issue.id,
                )?.bodySummary;
                const commentsSummary = commentSummaries.find(
                  (s) => s.issueId === issue.id,
                )?.commentsSummary;
                // this should never happen
                if (
                  bodySummary === undefined ||
                  commentsSummary === undefined
                ) {
                  throw new Error(`No summary found for issue #${issue.id}`);
                }
                return {
                  issueId: issue.id,
                  overallSummary: await generateOverallSummary(
                    {
                      bodySummary,
                      commentsSummary,
                      issue,
                    },
                    openai,
                  ),
                };
              }),
            );
          },
        );

        // Update issues with summaries
        const summaries = await step.do(
          `bulk update issues with summaries in db (batch ${idx + 1} of ${totalBatches})`,
          getStepDuration("medium"),
          async () => {
            const summaries = issues.map((issue) => {
              const bodySummary = bodySummaries.find(
                (s) => s.issueId === issue.id,
              )?.bodySummary;
              const commentsSummary = commentSummaries.find(
                (s) => s.issueId === issue.id,
              )?.commentsSummary;
              const overallSummary = overallSummaries.find(
                (s) => s.issueId === issue.id,
              )?.overallSummary;
              if (
                bodySummary === undefined ||
                commentsSummary === undefined ||
                overallSummary === undefined
              ) {
                throw new Error(`No summary found for issue #${issue.id}`);
              }
              return {
                issueId: issue.id,
                bodySummary,
                commentsSummary,
                overallSummary,
              };
            });
            await bulkUpdateIssueSummaries(summaries, dbSession);
            return summaries;
          },
        );

        const embeddings = await step.do(
          `create embeddings for selected issues from API (batch ${idx + 1} of ${totalBatches})`,
          getStepDuration("medium"),
          async () => {
            return await createEmbeddings({
              issues,
              summaries,
              openai,
            });
          },
        );

        await step.do(
          `upsert issue embeddings in db (batch ${idx + 1})`,
          getStepDuration("medium"),
          async () => {
            await upsertIssueEmbeddings(embeddings, dbSession);
          },
        );
      };
      await pMap(chunkedIssues, async (issues, idx) => {
        return await batchEmbedIssues(issues, idx, chunkedIssues.length);
      });
      if (mode === "cron") {
        await step.do(
          "call itself recursively to update embeddings",
          async () => {
            await this.env.SYNC_EMBEDDING_WORKFLOW.create({
              id: generateSyncWorkflowId("embedding"),
              params: { mode: "cron" },
            });
          },
        );
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
      const isWorkflowTimeoutError = errorMessage.includes(
        "WorkflowTimeoutError",
      );
      if (isWorkflowTimeoutError) {
        // just throw the error and initiate a retry
        throw e;
      }
      if (mode === "init") {
        const { repoId, repoName } = event.payload;
        await step.do(
          `sync unsuccessful, mark repo ${repoName} init status to error`,
          getStepDuration("short"),
          async () => {
            await db
              .update(repos)
              // this prevents the repo from being re-init again
              .set({ initStatus: "error" })
              .where(eq(repos.id, repoId));
          },
        );
        await step.do("send email notification", async () => {
          await sendEmail(
            {
              to: "warren@coder.com",
              subject: `${repoName} embedding failed`,
              html: `<p>Embedding failed, error: ${errorMessage}</p>`,
            },
            emailClient,
            getEnvPrefix(this.env.ENVIRONMENT),
          );
        });
      }
      if (mode === "cron") {
        await step.do(
          "update issue embedding sync status to error",
          getStepDuration("short"),
          async () => {
            await db
              .update(issueEmbeddings)
              .set({ embeddingSyncStatus: "error" })
              .where(
                inArray(
                  issueEmbeddings.issueId,
                  // a little overinclusive...
                  issuesToEmbed.map((i) => i.id),
                ),
              );
          },
        );
        await step.do("send email notification", async () => {
          const errorMessage =
            e instanceof Error ? e.message : JSON.stringify(e);
          const affectedIssueIds = issuesToEmbed.map((i) => i.id).join(", ");
          await sendEmail(
            {
              to: "warren@coder.com",
              subject: `Embedding failed`,
              html: `<p>Embedding failed, error: ${errorMessage}. Affected issue IDs: ${affectedIssueIds}</p>`,
            },
            emailClient,
            getEnvPrefix(this.env.ENVIRONMENT),
          );
        });
        await step.do(
          "call itself recursively to update embeddings",
          async () => {
            await this.env.SYNC_EMBEDDING_WORKFLOW.create({
              id: generateSyncWorkflowId("embedding"),
              params: { mode: "cron" },
            });
          },
        );
      }
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
