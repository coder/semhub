import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import pMap from "p-map";

import type { WranglerSecrets } from "@/core/constants/wrangler";
import { eq } from "@/core/db";
import { repos } from "@/core/db/schema/entities/repo.sql";
import { Embedding } from "@/core/embedding";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import { chunkArray, type WorkflowRPC } from "@/workflows/sync-repo/util";

interface Env extends WranglerSecrets {
  REPO_INIT_WORKFLOW: Workflow;
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
    try {
      const issueLastUpdated = await step.do(
        `get issue last updated at for ${name}`,
        async () => {
          // issues must have embeddings to be considered "updated"
          return Repo.getRepoLastIssueWithEmbedding(repoId, db);
        },
      );
      const { dataArray, hasMoreIssues } = await step.do(
        `get 5 API calls worth of data for ${name}`,
        async () => {
          const dataArray = [];
          let currentSince = issueLastUpdated;
          let hasMoreIssues = true;

          // Try up to 5 API calls
          for (let i = 0; i < 5 && hasMoreIssues; i++) {
            const { hasIssues, issuesAndCommentsLabels, lastIssueUpdatedAt } =
              await step.do(
                `get latest issues of ${name} from GitHub (batch ${i + 1})`,
                async () => {
                  return await Github.getLatestRepoIssues({
                    repoId,
                    repoName,
                    repoOwner,
                    octokit: graphqlOctokit,
                    since: currentSince,
                    numIssues: 100,
                  });
                },
              );

            // Break if no more issues
            if (!hasIssues) {
              hasMoreIssues = false;
              break;
            }
            if (!lastIssueUpdatedAt) {
              throw new NonRetryableError("lastIssueUpdatedAt is undefined");
            }

            dataArray.push(issuesAndCommentsLabels);
            currentSince = lastIssueUpdatedAt;
          }

          return { dataArray, hasMoreIssues };
        },
      );
      await Promise.all(
        dataArray.map(async (issuesAndCommentsLabels) => {
          const insertedIssueIds = await Repo.upsertIssuesCommentsLabels(
            issuesAndCommentsLabels,
            db,
          );
          // call worker to create and insert embeddings
          // TODO:
        }),
      );
      // call itself recursively
      if (hasMoreIssues) {
        this.env.REPO_INIT_WORKFLOW.create({
          params: { repoId },
        });
      } else {
        // no more work to be done, set initStatus to completed and return
        await step.do(`init for repo ${name} completed`, async () => {
          await db
            .update(repos)
            .set({ initStatus: "completed", initializedAt: new Date() })
            .where(eq(repos.id, repoId));
        });
      }
      // TODO: remove everything else below this
      const insertedIssueIds = await step.do(
        "upsert issues, comments, and labels",
        async () => {
          return await Repo.upsertIssuesCommentsLabels(
            issuesAndCommentsLabels,
            db,
          );
        },
      );
      const BATCH_SIZE = 50;
      const chunkedIssueIds = chunkArray(insertedIssueIds, BATCH_SIZE);
      const batchEmbedIssues = async (
        issueIds: string[],
        idx: number,
      ): Promise<void> => {
        const selectedIssues = await step.do(
          `selecting issues from db for embedding (batch ${idx + 1}) for ${repoName}`,
          async () => {
            return await Embedding.selectIssuesForEmbedding(issueIds, db);
          },
        );
        const embeddings = await step.do(
          `create embeddings for selected issues from API for ${repoName}`,
          async () => {
            return await Embedding.createEmbeddings({
              issues: selectedIssues,
              rateLimiter: null,
              openai,
            });
          },
        );
        await step.do(
          `update issue embeddings in db for ${repoName}`,
          async () => {
            await Embedding.bulkUpdateIssueEmbeddings(embeddings, db);
          },
        );
      };
      await pMap(chunkedIssueIds, async (issueIds, idx) => {
        return await batchEmbedIssues(issueIds, idx);
      });
      // successfully performed one unit of work, calls itself recursively before ending
      await step.do(
        "successfully performed one unit of work, call itself recursively",
        async () => {
          this.env.REPO_INIT_WORKFLOW.create({
            params: { repoId },
          });
        },
      );
      // TODO: remove everything above this
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
