import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { WranglerEnv } from "@/core/constants/wrangler.constant";
import { eq } from "@/core/db";
import { repos, syncCursorSchema } from "@/core/db/schema/entities/repo.sql";
import { sendEmail } from "@/core/email";
import { getLatestGithubRepoIssues } from "@/core/github";
import { Installation } from "@/core/installation";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import { getEnvPrefix } from "@/util";
import { getStepDuration } from "@/workflows/workflow.param";
import {
  getApproximateSizeInBytes,
  type WorkflowRPC,
} from "@/workflows/workflow.util";

import {
  getNumIssues,
  getSizeLimit,
  REDUCE_ISSUES_MAX_ATTEMPTS,
} from "../sync.param";
import { generateSyncWorkflowId } from "../sync.util";

interface Env extends WranglerEnv {
  SYNC_ISSUE_WORKFLOW: Workflow;
}

export class IssueWorkflow extends WorkflowEntrypoint<Env> {
  async run(_: WorkflowEvent<{}>, step: WorkflowStep) {
    const {
      db,
      dbSession,
      graphqlOctokit,
      emailClient,
      restOctokitAppFactory,
      graphqlOctokitAppFactory,
    } = getDeps(this.env);
    let responseSizeForDebugging = 0;
    let caughtName: string | null = null;
    let caughtRepoId: string | null = null;
    try {
      const res = await step.do(
        "get repo data and mark as in progress",
        getStepDuration("short"),
        async () => {
          return await Repo.markNextEnqueuedRepoInProgress(db);
        },
      );
      const syncComplete = !res;
      await step.do(
        syncComplete ? "sync complete, returning early" : "proceed to sync",
        async () => {
          return;
        },
      );
      if (syncComplete) {
        return;
      }
      const {
        repoId,
        repoName,
        repoOwner,
        repoIssuesLastUpdatedAt,
        isPrivate,
        repoSyncCursor: repoSyncCursorRaw,
      } = res;
      const repoSyncCursor = repoSyncCursorRaw
        ? syncCursorSchema.parse(repoSyncCursorRaw)
        : null;
      const name = `${repoOwner}/${repoName}`;
      caughtName = name;
      caughtRepoId = repoId;
      // don't have to worry about getting same issues twice because
      // we are using hasNextPage to determine if we should continue
      let syncCursor = (() => {
        // syncing for the first time
        if (!repoSyncCursor || !repoIssuesLastUpdatedAt) {
          return null;
        }
        if (
          repoIssuesLastUpdatedAt.getTime() === repoSyncCursor.since.getTime()
        ) {
          // only use after if since is the same
          return {
            since: repoIssuesLastUpdatedAt,
            after: repoSyncCursor.after,
          };
        }
        return {
          since: repoIssuesLastUpdatedAt,
          after: null,
        };
      })();

      while (true) {
        const {
          hasNextPage,
          issuesAndCommentsLabels,
          lastIssueUpdatedAt,
          endCursor,
        } = await step.do(
          `get latest issues of ${name} from GitHub`,
          async () => {
            // NB octokit cannot be serialized
            const octokit = await (async () => {
              if (!isPrivate) {
                return graphqlOctokit;
              }
              const installation =
                await Installation.getActiveGithubInstallationId({
                  userId: null,
                  repoName,
                  repoOwner,
                  db,
                  restOctokitAppFactory,
                });
              if (!installation) {
                throw new NonRetryableError("Installation not found");
              }
              return graphqlOctokitAppFactory(
                installation.githubInstallationId,
              );
            })();
            for (
              let attempt = 0;
              attempt <= REDUCE_ISSUES_MAX_ATTEMPTS;
              attempt++
            ) {
              const numIssues = getNumIssues(attempt, name);
              const result = await getLatestGithubRepoIssues({
                repoId,
                repoName,
                repoOwner,
                octokit,
                numIssues,
                since: syncCursor?.since ?? null,
                after: syncCursor?.after ?? null,
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
        syncCursor = (() => {
          // repo has no issue
          if (!endCursor || !lastIssueUpdatedAt) {
            return null;
          }
          if (
            syncCursor &&
            syncCursor.since &&
            lastIssueUpdatedAt.getTime() === syncCursor.since.getTime()
          ) {
            return {
              since: lastIssueUpdatedAt,
              after: endCursor,
            };
          }
          return {
            since: lastIssueUpdatedAt,
            after: null,
          };
        })();
        await step.do(
          `upsert issues and comments/labels of ${name}`,
          getStepDuration("long"),
          async () => {
            await Repo.upsertIssuesCommentsLabels(
              issuesAndCommentsLabels,
              dbSession,
            );
          },
        );

        if (!hasNextPage) {
          break;
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
      }
      await step.do(
        "set issuesLastUpdatedAt and syncCursor",
        getStepDuration("short"),
        async () => {
          await Repo.setIssuesLastUpdatedAt(repoId, db, syncCursor);
        },
      );
      // mark repo as synced
      await step.do(
        `mark ${name} as synced`,
        getStepDuration("short"),
        async () => {
          await db
            .update(repos)
            .set({ syncStatus: "ready", lastSyncedAt: new Date() })
            .where(eq(repos.id, repoId));
        },
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
      const isNoIssuesError = errorMessage.includes("has no issues");
      if (isNoIssuesError) {
        throw e;
      }
      // mark repo as error
      await step.do(
        `mark ${caughtName} as error`,
        getStepDuration("short"),
        async () => {
          if (!caughtRepoId) {
            throw new NonRetryableError("caughtRepoId is undefined");
          }
          await db
            .update(repos)
            .set({ syncStatus: "error" })
            .where(eq(repos.id, caughtRepoId));
        },
      );
      await step.do("send email notification", async () => {
        const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
        const errorMessageWithResponseSize = `${errorMessage} (response size: ${responseSizeForDebugging} bytes)`;
        await sendEmail(
          {
            to: "warren@coder.com",
            subject: `${caughtName} sync failed`,
            html: `<p>Sync failed, error: ${errorMessageWithResponseSize}</p>`,
          },
          emailClient,
          getEnvPrefix(this.env.ENVIRONMENT),
        );
      });
    }
    // even if there is an error with one repo, we still want to sync the rest
    // call itself recursively to sync next repo
    await step.do("call itself recursively to sync next repo", async () => {
      await this.env.SYNC_ISSUE_WORKFLOW.create({
        id: generateSyncWorkflowId("issue"),
      });
    });
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
    const { id } = await env.SYNC_ISSUE_WORKFLOW.create(options);
    return id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.SYNC_ISSUE_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.SYNC_ISSUE_WORKFLOW.get(id);
    return await instance.status();
  },
} satisfies WorkflowRPC;
