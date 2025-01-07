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
import { getDbStepConfig } from "@/workflows/workflow.param";
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
        getDbStepConfig("short"),
        async () => {
          return await Repo.markNextEnqueuedRepoInProgress(db);
        },
      );
      if (!res) {
        // all repos have been synced, return early
        return;
      }
      const {
        repoId,
        repoName,
        repoOwner,
        issuesLastEndCursor,
        repoIssuesLastUpdatedAt: repoIssuesLastUpdatedAtRaw,
        isPrivate,
      } = res;
      const name = `${repoOwner}/${repoName}`;
      caughtName = name;
      caughtRepoId = repoId;
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
      let currentSince = repoIssuesLastUpdatedAtRaw
        ? new Date(repoIssuesLastUpdatedAtRaw)
        : null;
      let hasMoreIssues = true;
      let after = issuesLastEndCursor ?? null;

      while (hasMoreIssues) {
        const {
          hasNextPage,
          issuesAndCommentsLabels,
          lastIssueUpdatedAt,
          endCursor,
        } = await step.do(
          `get latest issues of ${name} from GitHub`,
          async () => {
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
                since: currentSince,
                numIssues,
                after,
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

        await step.do(
          `upsert issues and comments/labels of ${name}`,
          getDbStepConfig("long"),
          async () => {
            await Repo.upsertIssuesCommentsLabels(issuesAndCommentsLabels, db);
          },
        );

        // endCursor is null if there is no more issues
        after = endCursor ?? after;
        if (!hasNextPage) {
          hasMoreIssues = false;
          break;
        }
        if (!lastIssueUpdatedAt) {
          throw new NonRetryableError("lastIssueUpdatedAt is undefined");
        }
        currentSince = lastIssueUpdatedAt;
      }
      await step.do(
        "update repo issuesLastEndCursor",
        getDbStepConfig("short"),
        async () => {
          if (after) {
            await db
              .update(repos)
              .set({ issuesLastEndCursor: after })
              .where(eq(repos.id, repoId));
          }
        },
      );
      // mark repo as synced
      await step.do(
        `mark ${name} as synced`,
        getDbStepConfig("short"),
        async () => {
          await db
            .update(repos)
            .set({ syncStatus: "ready", lastSyncedAt: new Date() })
            .where(eq(repos.id, repoId));
        },
      );
    } catch (e) {
      // mark repo as error
      await step.do(
        `mark ${caughtName} as error`,
        getDbStepConfig("short"),
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
    await step.do(`call itself recursively to sync next repo`, async () => {
      await this.env.SYNC_ISSUE_WORKFLOW.create({
        id: generateSyncWorkflowId("sync-issue"),
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
