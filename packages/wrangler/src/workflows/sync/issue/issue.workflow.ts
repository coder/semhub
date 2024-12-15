import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";

import type { WranglerEnv } from "@/core/constants/wrangler.constant";
import { eq } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { sendEmail } from "@/core/email";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import { getEnvPrefix } from "@/util";
import { type WorkflowRPC } from "@/workflows/workflow.util";

import { getDbStepConfig } from "../sync.param";
import { generateSyncWorkflowId } from "../sync.util";

interface Env extends WranglerEnv {
  SYNC_ISSUE_WORKFLOW: Workflow;
}

export class IssueWorkflow extends WorkflowEntrypoint<Env> {
  async run(_: WorkflowEvent<{}>, step: WorkflowStep) {
    const { db, graphqlOctokit, emailClient } = getDeps(this.env);
    const res = await step.do(
      "get repo data and mark as syncing",
      getDbStepConfig("short"),
      async () => {
        return await Repo.getNextEnqueuedRepo(db);
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
      repoIssuesLastUpdatedAt: repoIssuesLastUpdatedAtRaw,
    } = res;
    const name = `${repoOwner}/${repoName}`;
    try {
      // FIXME: this will fail if there are too many issues to sync
      // can consider using children worker? let's fix only if this is an issue
      // unlikely to have so many new issues within cron interval
      // TODO: also, can consider fetching more than 100 comments to detect controversy
      const { issuesAndCommentsLabels } = await step.do(
        `get latest issues of ${name} from GitHub`,
        async () => {
          return await Github.getIssuesViaIterator(
            {
              repoId,
              repoName,
              repoOwner,
              repoIssuesLastUpdatedAt: repoIssuesLastUpdatedAtRaw
                ? new Date(repoIssuesLastUpdatedAtRaw)
                : null,
            },
            graphqlOctokit,
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
      await step.do("send email notification", async () => {
        const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
        await sendEmail(
          {
            to: "warren@coder.com",
            subject: `${name} sync failed`,
            html: `<p>Sync failed, error: ${errorMessage}</p>`,
          },
          emailClient,
          getEnvPrefix(this.env.ENVIRONMENT),
        );
      });
      // mark repo as error
      await step.do(
        `mark ${name} as error`,
        getDbStepConfig("short"),
        async () => {
          await db
            .update(repos)
            .set({ syncStatus: "error" })
            .where(eq(repos.id, repoId));
        },
      );
      throw e;
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
