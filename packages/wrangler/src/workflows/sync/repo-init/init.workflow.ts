import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { WranglerEnv } from "@/core/constants/wrangler.constant";
import { eq } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { sendEmail } from "@/core/email";
import { getLatestGithubRepoIssues } from "@/core/github";
import { Installation } from "@/core/installation";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import { getEnvPrefix } from "@/util";
import {
  getNumIssues,
  getSizeLimit,
  NUM_EMBEDDING_WORKERS,
  PARENT_WORKER_SLEEP_DURATION,
  REDUCE_ISSUES_MAX_ATTEMPTS,
} from "@/workflows/sync/sync.param";
import { getStepDuration } from "@/workflows/workflow.param";
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

export type RepoInitParams = {
  repoId: string;
};

// Note that this workflow must be recursive, i.e. it will keep invoking itself
// until the repo is fully initialized
export class RepoInitWorkflow extends WorkflowEntrypoint<Env, RepoInitParams> {
  async run(event: WorkflowEvent<RepoInitParams>, step: WorkflowStep) {
    const { repoId } = event.payload;
    const {
      db,
      dbSession,
      graphqlOctokit,
      emailClient,
      graphqlOctokitAppFactory,
      restOctokitAppFactory,
    } = getDeps(this.env);
    // wait 10 seconds before starting
    // this prevents race condition where in_progress status has not been committed yet
    await step.sleep(
      "wait for in_progress status to be committed",
      "30 seconds",
    );
    const result = await step.do(
      "get repo info from db",
      getStepDuration("short"),
      async () => {
        const [result] = await db
          .select({
            initStatus: repos.initStatus,
            repoName: repos.name,
            repoOwner: repos.ownerLogin,
            isPrivate: repos.isPrivate,
            repoIssuesLastUpdatedAt: repos.issuesLastUpdatedAt,
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
    const { repoName, repoOwner, repoIssuesLastUpdatedAt, isPrivate } = result;
    const name = `${repoOwner}/${repoName}`;
    let responseSizeForDebugging = 0;
    try {
      const octokit = await (async () => {
        if (!isPrivate) {
          return graphqlOctokit;
        }
        const installation = await Installation.getActiveGithubInstallationId({
          userId: null,
          repoName,
          repoOwner,
          db,
          restOctokitAppFactory,
        });
        if (!installation) {
          throw new NonRetryableError("Installation not found");
        }
        return graphqlOctokitAppFactory(installation.githubInstallationId);
      })();
      const { issueIdsArray, hasMoreIssues } = await step.do(
        `get ${NUM_EMBEDDING_WORKERS} API calls worth of data for ${name}`,
        {
          timeout: "12 minutes",
          retries: {
            limit: 10,
            backoff: "constant",
            delay: "20 seconds",
          },
        },
        async () => {
          const issueIdsArray = [];
          let currentSince = repoIssuesLastUpdatedAt
            ? new Date(repoIssuesLastUpdatedAt)
            : null;
          let hasMoreIssues = true;

          for (let i = 0; i < NUM_EMBEDDING_WORKERS && hasMoreIssues; i++) {
            const { hasNextPage, issuesAndCommentsLabels, lastIssueUpdatedAt } =
              await step.do(
                `get latest issues of ${name} from GitHub (batch ${i + 1})`,
                async () => {
                  for (
                    let attempt = 0;
                    attempt <= REDUCE_ISSUES_MAX_ATTEMPTS;
                    attempt++
                  ) {
                    const numIssues = getNumIssues(attempt);
                    const result = await getLatestGithubRepoIssues({
                      repoId,
                      repoName,
                      repoOwner,
                      octokit,
                      since: currentSince,
                      numIssues,
                    });

                    const responseSize = getApproximateSizeInBytes(result);
                    if (responseSize <= getSizeLimit(name)) {
                      responseSizeForDebugging = responseSize;
                      return result;
                    }
                    if (attempt < REDUCE_ISSUES_MAX_ATTEMPTS) {
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
            if (!hasNextPage) {
              hasMoreIssues = false;
            }
            if (!lastIssueUpdatedAt) {
              await db
                .update(repos)
                .set({ initStatus: "no_issues" })
                .where(eq(repos.id, repoId));
              throw new NonRetryableError(
                `Repo ${repoOwner}/${repoName} has no issues, skipping embedding`,
              );
            }
            const insertedIssueIds = await step.do(
              "upsert issues, comments, and labels",
              getStepDuration("very long"),
              async () => {
                return await Repo.upsertIssuesCommentsLabels(
                  issuesAndCommentsLabels,
                  dbSession,
                );
              },
            );
            issueIdsArray.push(insertedIssueIds);
            currentSince = lastIssueUpdatedAt;
          }

          return { issueIdsArray, hasMoreIssues };
        },
      );
      await Promise.all(
        issueIdsArray.map(async (issueIds) => {
          await step.do(
            "call worker to create and insert embeddings",
            async () => {
              const embeddingWorkflowId =
                await this.env.SYNC_EMBEDDING_WORKFLOW.create({
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
                // if the children workflow has errored out, it should be a terminal state and we should throw an error here
                // that would force a retry
                // however, I have observed that an errored out workflow can still continue to run (wtf)
                if (status === "errored" || status === "terminated") {
                  throw new Error("Embedding worker failed, retrying now");
                }
              }
            },
          );
        }),
      );
      await step.do(
        "set issuesLastUpdatedAt",
        getStepDuration("short"),
        async () => {
          await Repo.setIssuesLastUpdatedAt(repoId, db);
        },
      );
      if (hasMoreIssues) {
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
          getStepDuration("short"),
          async () => {
            await db
              .update(repos)
              .set({ initStatus: "completed", initializedAt: new Date() })
              .where(eq(repos.id, repoId));
          },
        );
        await step.do("send email notification", async () => {
          await sendEmail(
            {
              to: "warren@coder.com",
              subject: `${name} init completed`,
              html: `<p>Init completed</p>`,
            },
            emailClient,
            getEnvPrefix(this.env.ENVIRONMENT),
          );
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
      const isEmbeddingWorkerFailedError = errorMessage.includes(
        "Embedding worker failed",
      );
      const isWorkflowTimeoutError = errorMessage.includes(
        "WorkflowTimeoutError",
      );
      const isNoIssuesError = errorMessage.includes("has no issues");
      if (
        isWorkflowTimeoutError ||
        isNoIssuesError ||
        isEmbeddingWorkerFailedError
      ) {
        // for workflow timeout and embedding worker failed error, it will just retry
        // for no issues error, it will just end the workflow
        throw e;
      }
      await step.do(
        "sync unsuccessful, mark repo init status to error",
        getStepDuration("short"),
        async () => {
          await db
            .update(repos)
            .set({ initStatus: "error" })
            .where(eq(repos.id, repoId));
        },
      );
      await step.do("send email notification", async () => {
        const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
        const errorMessageWithResponseSize = `${errorMessage} (response size: ${responseSizeForDebugging} bytes)`;
        await sendEmail(
          {
            to: "warren@coder.com",
            subject: `${name} init failed`,
            html: `<p>Init failed, error: ${errorMessageWithResponseSize}</p>`,
          },
          emailClient,
          getEnvPrefix(this.env.ENVIRONMENT),
        );
      });
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
