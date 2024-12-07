import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { and, asc, eq } from "@/core/db";
import type { DbClient } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Github } from "@/core/github";
import { Repo, repoIssuesLastUpdatedSql } from "@/core/repo";
import { getDeps } from "@/deps";
import { type WorkflowRPC } from "@/workflows/sync/util";

interface Env extends WranglerSecrets {
  SYNC_ISSUE_CRON_WORKFLOW: Workflow;
}

export class IssueCronWorkflow extends WorkflowEntrypoint<Env> {
  async run(_: WorkflowEvent<{}>, step: WorkflowStep) {
    const { db, graphqlOctokit } = getDeps(this.env);
    const res = await step.do("get next repo for issue sync", async () => {
      return await getNextRepoForIssueSync(db);
    });
    if (!res) {
      // all repos have been synced, return early
      return;
    }
    const {
      repoId,
      repoName,
      repoOwner,
      repoIssuesLastUpdatedAt: stringifiedLastUpdatedAt,
    } = res;
    const name = `${repoOwner}/${repoName}`;
    try {
      // mark repo as syncing
      await step.do(`mark ${name} as syncing in progress`, async () => {
        await db
          .update(repos)
          .set({ syncStatus: "in_progress" })
          .where(eq(repos.id, repoId));
      });
      // bet that there aren't that many issues to sync?
      const { issuesAndCommentsLabels } = await step.do(
        `get latest issues of ${name} from GitHub`,
        async () => {
          return await Github.getIssuesViaIterator(
            {
              repoId,
              repoName,
              repoOwner,
              repoIssuesLastUpdatedAt: stringifiedLastUpdatedAt
                ? new Date(stringifiedLastUpdatedAt)
                : null,
            },
            graphqlOctokit,
          );
        },
      );
      await step.do(
        `upsert issues and comments/labels of ${name}`,
        async () => {
          await Repo.upsertIssuesCommentsLabels(issuesAndCommentsLabels, db);
        },
      );
      // mark repo as synced
      await step.do(`mark ${name} as synced`, async () => {
        await db
          .update(repos)
          .set({ syncStatus: "ready" })
          .where(eq(repos.id, repoId));
      });
    } catch (e) {
      // mark repo as error
      await step.do(`mark ${name} as error`, async () => {
        await db
          .update(repos)
          .set({ syncStatus: "error" })
          .where(eq(repos.id, repoId));
      });
      throw e;
    }
    // even if there is an error with one repo, we still want to sync the rest
    // call itself recursively to sync next repo
    await step.do(`call itself recursively to sync next repo`, async () => {
      await this.env.SYNC_ISSUE_CRON_WORKFLOW.create({});
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
    const { id } = await env.SYNC_ISSUE_CRON_WORKFLOW.create(options);
    return id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.SYNC_ISSUE_CRON_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.SYNC_ISSUE_CRON_WORKFLOW.get(id);
    return await instance.status();
  },
} satisfies WorkflowRPC;

async function getNextRepoForIssueSync(db: DbClient) {
  const [repo] = await db
    .select({
      repoId: repos.id,
      repoName: repos.name,
      repoOwner: repos.owner,
      repoIssuesLastUpdatedAt: repoIssuesLastUpdatedSql(repos),
    })
    .from(repos)
    .where(
      and(eq(repos.initStatus, "completed"), eq(repos.syncStatus, "queued")),
    )
    .orderBy(asc(repos.lastSyncedAt))
    .limit(1);
  if (!repo) {
    return null;
  }
  return repo;
}
