import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { eq } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Github } from "@/core/github";
import { Repo, repoIssuesLastUpdatedSql } from "@/core/repo";
import { getDeps } from "@/deps";
import { isWorkersSizeLimitError } from "@/errors";
import { type WorkflowRPC } from "@/workflows/sync/util";

import type { EmbeddingParams } from "../embedding/update.workflow";

interface Env extends WranglerSecrets {
  REPO_INIT_WORKFLOW: Workflow;
  SYNC_REPO_EMBEDDING_WORKFLOW: WorkflowRPC<EmbeddingParams>;
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
    const { db, graphqlOctokit } = getDeps(this.env);
    const result = await step.do("get repo info from db", async () => {
      const [result] = await db
        .select({
          initStatus: repos.initStatus,
          repoName: repos.name,
          repoOwner: repos.owner,
          issueLastUpdatedAt: repoIssuesLastUpdatedSql(repos),
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
    });
    const { repoName, repoOwner, issueLastUpdatedAt } = result;
    const name = `${repoOwner}/${repoName}`;
    try {
      const { issueIdsArray, hasMoreIssues } = await step.do(
        `get 5 API calls worth of data for ${name}`,
        async () => {
          const issueIdsArray = [];
          let currentSince = issueLastUpdatedAt
            ? new Date(issueLastUpdatedAt)
            : null;
          let hasMoreIssues = true;

          // TODO: extract const
          const REDUCE_ISSUES_MAX_ATTEMPTS = 4;
          for (let i = 0; i < 7 && hasMoreIssues; i++) {
            const { hasNextPage, issuesAndCommentsLabels, lastIssueUpdatedAt } =
              await step.do(
                `get latest issues of ${name} from GitHub (batch ${i + 1})`,
                async () => {
                  let attempt = 1;
                  while (attempt <= REDUCE_ISSUES_MAX_ATTEMPTS) {
                    try {
                      const result = await Github.getLatestRepoIssues({
                        repoId,
                        repoName,
                        repoOwner,
                        octokit: graphqlOctokit,
                        since: currentSince,
                        numIssues: 50 - attempt * 10,
                      });
                      return result;
                    } catch (e) {
                      if (
                        isWorkersSizeLimitError(e) &&
                        attempt < REDUCE_ISSUES_MAX_ATTEMPTS
                      ) {
                        console.log(
                          `Retrying issues for ${name} with reduced numIssues: ${50 - (attempt + 1) * 10}`,
                        );
                        attempt++;
                        continue;
                      }
                      throw e;
                    }
                  }
                  throw new NonRetryableError(
                    `Failed to get issues for ${name} after ${REDUCE_ISSUES_MAX_ATTEMPTS} attempts`,
                  );
                },
              );
            // Break if no more issues
            if (!hasNextPage) {
              hasMoreIssues = false;
              break;
            }
            if (!lastIssueUpdatedAt) {
              throw new NonRetryableError("lastIssueUpdatedAt is undefined");
            }
            const insertedIssueIds = await step.do(
              "upsert issues, comments, and labels",
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

          return { issueIdsArray, hasMoreIssues };
        },
      );
      await Promise.all(
        issueIdsArray.map(async (issueIds) => {
          const embeddingWorkflowId = await step.do(
            "call worker to create and insert embeddings",
            async () => {
              return await this.env.SYNC_REPO_EMBEDDING_WORKFLOW.create({
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
            await step.sleep("wait for worker to finish", "30 seconds");
            const { status } =
              await this.env.SYNC_REPO_EMBEDDING_WORKFLOW.getInstanceStatus(
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
      // call itself recursively
      if (hasMoreIssues) {
        await step.do(
          "performed one unit of work, call itself recursively",
          async () => {
            await this.env.REPO_INIT_WORKFLOW.create({
              params: { repoId },
            });
          },
        );
      } else {
        // no more work to be done, set initStatus to completed and return
        await step.do(`init for repo ${name} completed`, async () => {
          await db
            .update(repos)
            .set({ initStatus: "completed", initializedAt: new Date() })
            .where(eq(repos.id, repoId));
        });
      }
    } catch (e) {
      await step.do(
        "sync unsuccessful, mark repo init status to error",
        async () => {
          // ideally, also log this error/send an email to me or sth
          await db
            .update(repos)
            // this prevents the repo from being re-init again
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
    // Return 400 for direct HTTP requests since workflows should be triggered via bindings
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
