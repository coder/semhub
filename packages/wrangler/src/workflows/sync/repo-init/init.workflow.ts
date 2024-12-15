import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { WranglerEnv } from "@/core/constants/wrangler.constant";
import { eq, sql } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { sendEmail } from "@/core/email";
import { Github } from "@/core/github";
import { Repo, repoIssuesLastUpdatedSql } from "@/core/repo";
import { getDeps } from "@/deps";
import { getEnvPrefix } from "@/util";
import {
  getDbStepConfig,
  getNumIssues,
  NUM_EMBEDDING_WORKERS,
  PARENT_WORKER_SLEEP_DURATION,
  REDUCE_ISSUES_MAX_ATTEMPTS,
  RESPONSE_SIZE_LIMIT_IN_BYTES,
} from "@/workflows/sync/sync.param";
import {
  getApproximateSizeInBytes,
  type WorkflowRPC,
} from "@/workflows/workflow.util";

import type { EmbeddingParams } from "../embedding/embedding.workflow";
import { generateSyncWorkflowId } from "../sync.util";

interface Env extends WranglerEnv {
  REPO_INIT_WORKFLOW: Workflow;
  SYNC_EMBEDDING_WORKFLOW: WorkflowRPC<EmbeddingParams>;
}

// User-defined params passed to your workflow
export type RepoInitParams = {
  repoId: string;
};

// Note that this workflow must be recursive, i.e. it will keep invoking itself
// until the repo is fully initialized
export class RepoInitWorkflow extends WorkflowEntrypoint<Env, RepoInitParams> {
  async run(event: WorkflowEvent<RepoInitParams>, step: WorkflowStep) {
    const { repoId } = event.payload;
    const { db, graphqlOctokit, emailClient } = getDeps(this.env);
    const result = await step.do(
      "get repo info from db",
      getDbStepConfig("short"),
      async () => {
        const [result] = await db
          .select({
            initStatus: repos.initStatus,
            repoName: repos.name,
            repoOwner: repos.owner,
            initLastEndCursor: repos.initLastEndCursor,
            issueLastUpdatedAt: sql<
              string | null
            >`(${repoIssuesLastUpdatedSql(repos, db)})`,
          })
          .from(repos)
          .where(eq(repos.id, repoId))
          .limit(1);
        if (!result) {
          throw new NonRetryableError("Repo not found");
        }
        if (result.initStatus !== "in_progress") {
          throw new NonRetryableError("Repo is not in progress");
        }
        return result;
      },
    );
    const { repoName, repoOwner, issueLastUpdatedAt, initLastEndCursor } =
      result;
    const name = `${repoOwner}/${repoName}`;
    try {
      const { issueIdsArray, hasMoreIssues, after } = await step.do(
        `get ${NUM_EMBEDDING_WORKERS} API calls worth of data for ${name}`,
        async () => {
          const issueIdsArray = [];
          let currentSince = issueLastUpdatedAt
            ? new Date(issueLastUpdatedAt)
            : null;
          let hasMoreIssues = true;
          let after = initLastEndCursor ?? null;

          for (let i = 0; i < NUM_EMBEDDING_WORKERS && hasMoreIssues; i++) {
            const {
              hasNextPage,
              issuesAndCommentsLabels,
              lastIssueUpdatedAt,
              endCursor,
            } = await step.do(
              `get latest issues of ${name} from GitHub (batch ${i + 1})`,
              async () => {
                for (
                  let attempt = 0;
                  attempt <= REDUCE_ISSUES_MAX_ATTEMPTS;
                  attempt++
                ) {
                  const numIssues = getNumIssues(attempt);
                  const result = await Github.getLatestRepoIssues({
                    repoId,
                    repoName,
                    repoOwner,
                    octokit: graphqlOctokit,
                    since: currentSince,
                    numIssues,
                    after,
                  });

                  const responseSize = getApproximateSizeInBytes(result);
                  if (responseSize <= RESPONSE_SIZE_LIMIT_IN_BYTES) {
                    return result;
                  }
                  if (attempt < REDUCE_ISSUES_MAX_ATTEMPTS) {
                    console.log(
                      `Response too large (${Math.round(responseSize / 1024)}KB) for ${name}, reducing numIssues from ${numIssues} to ${Math.max(2, Math.floor(numIssues / 2))}`,
                    );
                    continue;
                  }
                  throw new NonRetryableError(
                    `Response size (${Math.round(responseSize / 1024)}KB) too large even with numIssues=${numIssues}. See: ${result.issuesAndCommentsLabels.issuesToInsert.map((issue) => issue.htmlUrl).join(", ")}`,
                  );
                }
                throw new NonRetryableError(
                  `Failed to get issues for ${name} after ${REDUCE_ISSUES_MAX_ATTEMPTS} attempts`,
                );
              },
            );
            after = endCursor;
            if (!hasNextPage) {
              hasMoreIssues = false;
              break;
            }
            if (!lastIssueUpdatedAt) {
              throw new NonRetryableError("lastIssueUpdatedAt is undefined");
            }
            const insertedIssueIds = await step.do(
              "upsert issues, comments, and labels",
              getDbStepConfig("long"),
              async () => {
                return await Repo.upsertIssuesCommentsLabels(
                  issuesAndCommentsLabels,
                  db,
                );
              },
            );
            issueIdsArray.push(insertedIssueIds);
            currentSince = lastIssueUpdatedAt;
          }

          return { issueIdsArray, hasMoreIssues, after };
        },
      );
      await Promise.all(
        issueIdsArray.map(async (issueIds) => {
          const embeddingWorkflowId = await step.do(
            "call worker to create and insert embeddings",
            async () => {
              return await this.env.SYNC_EMBEDDING_WORKFLOW.create({
                id: generateSyncWorkflowId(
                  `embedding-${repoOwner}-${repoName}`,
                ),
                params: {
                  mode: "init",
                  issueIds,
                  repoName,
                  repoId,
                },
              });
            },
          );
          while (true) {
            await step.sleep(
              "wait for worker to finish",
              PARENT_WORKER_SLEEP_DURATION,
            );
            const { status } =
              await this.env.SYNC_EMBEDDING_WORKFLOW.getInstanceStatus(
                embeddingWorkflowId,
              );
            if (status === "complete") {
              return;
            }
            if (status === "errored" || status === "terminated") {
              throw new NonRetryableError("Embedding worker failed");
            }
          }
        }),
      );
      if (hasMoreIssues) {
        await step.do(
          "update repo initLastEndCursor",
          getDbStepConfig("short"),
          async () => {
            await db
              .update(repos)
              .set({ initLastEndCursor: after })
              .where(eq(repos.id, repoId));
          },
        );
        await step.do(
          "performed one unit of work, call itself recursively",
          async () => {
            await this.env.REPO_INIT_WORKFLOW.create({
              id: generateSyncWorkflowId(`init-${repoOwner}-${repoName}`),
              params: { repoId },
            });
          },
        );
      } else {
        await step.do(
          `init for repo ${name} completed`,
          getDbStepConfig("short"),
          async () => {
            await db
              .update(repos)
              .set({ initStatus: "completed", initializedAt: new Date() })
              .where(eq(repos.id, repoId));
          },
        );
      }
    } catch (e) {
      await step.do("send email notification", async () => {
        const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
        await sendEmail(
          {
            to: "warren@coder.com",
            subject: `${name} init failed`,
            html: `<p>Init failed, error: ${errorMessage}</p>`,
          },
          emailClient,
          getEnvPrefix(this.env.ENVIRONMENT),
        );
      });
      await step.do(
        "sync unsuccessful, mark repo init status to error",
        getDbStepConfig("short"),
        async () => {
          await db
            .update(repos)
            .set({ initStatus: "error" })
            .where(eq(repos.id, repoId));
        },
      );
      throw e;
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return Response.json(
      { error: "Workflows must be triggered via bindings" },
      { status: 400 },
    );
  },
  async create(options, env: Env) {
    const workflow = await env.REPO_INIT_WORKFLOW.create(options);
    return workflow.id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.REPO_INIT_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.REPO_INIT_WORKFLOW.get(id);
    const status = await instance.status();
    return status;
  },
} satisfies WorkflowRPC<RepoInitParams>;
