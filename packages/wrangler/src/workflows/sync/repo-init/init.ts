import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { eq } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/rate-limiter";
import type { WorkflowRPC } from "@/workflows/sync-repo/util";

interface Env extends WranglerSecrets {
  RATE_LIMITER: Service<RateLimiterWorker>;
  SYNC_REPO_INIT_WORKFLOW: Workflow;
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
    const { DATABASE_URL, GITHUB_PERSONAL_ACCESS_TOKEN, OPENAI_API_KEY } =
      this.env;
    const { db, graphqlOctokit, openai } = getDeps({
      databaseUrl: DATABASE_URL,
      githubPersonalAccessToken: GITHUB_PERSONAL_ACCESS_TOKEN,
      openaiApiKey: OPENAI_API_KEY,
    });
    const result = await step.do("get repo info from db", async () => {
      const [result] = await db
        .select({
          initStatus: repos.initStatus,
          repoName: repos.name,
          repoOwner: repos.owner,
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
    const { repoName, repoOwner } = result;
    const name = `${repoOwner}/${repoName}`;
    const issueLastUpdated = await step.do(
      "get issue last updated at",
      async () => {
        // issues must have embeddings to be considered "updated"
        return Repo.getRepoIssueLastUpdatedAt(repoId, db);
      },
    );
    const { hasIssues, issuesAndCommentsLabels } = await step.do(
      "get latest issues from GitHub",
      async () => {
        return await Github.getLatestRepoIssues({
          repoId,
          repoName,
          repoOwner,
          octokit: graphqlOctokit,
          since: issueLastUpdated,
        });
      },
    );
    if (!hasIssues) {
      // no more work to be done, set initStatus to completed and return
      await step.do(`init for repo ${name} completed`, async () => {
        await db
          .update(repos)
          .set({ initStatus: "completed", initializedAt: new Date() })
          .where(eq(repos.id, repoId));
      });
      return;
    }
    try {
      const insertedIssueIds = await step.do(
        "upsert issues, comments, and labels",
        async () => {
          return await Repo.upsertIssuesCommentsLabels(
            issuesAndCommentsLabels,
            db,
          );
        },
      );
      const selectedIssues = await step.do(
        `selecting issues from db for embedding for ${repoName}`,
        async () => {
          return await Embedding.selectIssuesForEmbedding(insertedIssueIds, db);
        },
      );
      const embeddings = await step.do(
        `create embeddings for selected issues from API for ${repoName}`,
        async () => {
          return await Embedding.createEmbeddings({
            issues: selectedIssues,
            rateLimiter: this.env.RATE_LIMITER,
            openai,
            // TODO: extract constants
            concurrencyLimit: 20,
          });
        },
      );
      await step.do(
        `update issue embeddings in db for ${repoName}`,
        async () => {
          await Embedding.bulkUpdateIssueEmbeddings(embeddings, db);
        },
      );
      // successfully performed one unit of work, calls itself recursively before ending
      // TODO: verify this works
      this.env.SYNC_REPO_INIT_WORKFLOW.create({
        params: { repoId },
      });
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
    const workflow = await env.SYNC_REPO_INIT_WORKFLOW.create(options);
    return workflow.id;
  },
  async terminate(id: string, env: Env) {
    const instance = await env.SYNC_REPO_INIT_WORKFLOW.get(id);
    await instance.terminate();
  },
  async getInstanceStatus(id: string, env: Env) {
    const instance = await env.SYNC_REPO_INIT_WORKFLOW.get(id);
    const status = await instance.status();
    return status;
  },
} satisfies WorkflowRPC<RepoInitParams>;
