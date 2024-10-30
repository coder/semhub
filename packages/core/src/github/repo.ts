import { createAppAuth } from "@octokit/auth-app";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { Octokit } from "octokit";
import { Resource } from "sst";

import { and, db, eq, sql } from "../db";
import { conflictUpdateAllExcept } from "../db/helper";
import {
  comments,
  type CreateComment,
} from "../db/schema/entities/comment.sql";
import {
  issues as issueTable,
  type CreateIssue,
} from "../db/schema/entities/issue.sql";
import { repos } from "../db/schema/entities/repo.sql";
import type { CommentGraphql } from "./schema";
import {
  getLoadRepoIssuesQuery,
  githubRepoSchema,
  loadIssuesWithCommentsQuerySchema,
  type IssueGraphql,
} from "./schema";

const appId = Resource.GITHUB_APP_ID.value;
const privateKey = Resource.GITHUB_APP_PRIVATE_KEY.value;
const installationId = Resource.GITHUB_APP_INSTALLATION_ID.value;

const coderRepoNames = [
  "coder",
  "vscode-coder",
  "jetbrains-coder",
  "internal",
  "envbuilder",
  // "customers", // private
];
// for testing
// const coderRepos = ["nexus"];

const OctokitWithGraphQLPaginate = Octokit.plugin(paginateGraphQL);

const octokit = new OctokitWithGraphQLPaginate({
  authStrategy: createAppAuth,
  auth: {
    appId,
    privateKey,
    installationId,
  },
});

export module GitHubRepo {
  export async function loadRepos() {
    for (const repo of coderRepoNames) {
      const { data: repoData } = await octokit.rest.repos.get({
        owner: "coder",
        repo,
      });
      const { success, data, error } = githubRepoSchema.safeParse(repoData);
      if (!success) {
        console.log("error parsing repo data from GitHub");
        console.error(error);
        console.log(repoData);
        break;
      }
      const {
        owner: { login: owner },
        name,
        node_id: nodeId,
        html_url: htmlUrl,
        private: isPrivate,
      } = data;
      await db
        .insert(repos)
        .values({
          owner,
          name,
          nodeId,
          htmlUrl,
          isPrivate,
        })
        .onConflictDoUpdate({
          target: [repos.nodeId],
          set: conflictUpdateAllExcept(repos, ["nodeId", "id", "createdAt"]),
        });
    }
  }
  // eventually we can make this general
  export async function loadIssues() {
    // general strategy: one repo at a time, ensure idempotency, interruptible, minimise redoing work, update if conflict
    // - get all issues (including pull requests) and save in database one batch at a time
    // - for each repo, we save the latest updated_at, which we will use in the `since` parameter
    // - if the repo already exists in the database, we get all issues since the last updated_at
    // - for each issue we save, if it is already in database, we upsert
    const coderRepos = await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
      })
      .from(repos)
      .where(and(eq(repos.owner, "coder")));
    outerLoop: for (const {
      repoId,
      repoName,
      issuesLastUpdatedAt,
    } of coderRepos) {
      const iterator = octokit.graphql.paginate.iterator(
        getLoadRepoIssuesQuery({ since: issuesLastUpdatedAt }),
        {
          organization: "coder",
          repo: repoName,
          cursor: null,
        },
      );
      for await (const response of iterator) {
        const { success, data, error } =
          loadIssuesWithCommentsQuerySchema.safeParse(response);
        if (!success) {
          console.error(error);
          console.log(JSON.stringify(response, null, 2));
          break outerLoop;
        }
        const issues = data.repository.issues.nodes;
        if (issues.length === 0) {
          continue;
        }
        const lastIssueUpdatedAt = new Date(
          issues[issues.length - 1]!.updatedAt,
        );
        const issuesToInsert = issues.map((issue) =>
          mapToCreateIssue(issue, repoId),
        );
        const commentsToInsert = issues.flatMap((issue) =>
          issue.comments.nodes.map((comment) =>
            mapToCreateComment(comment, issue.id),
          ),
        );
        await db.transaction(async (tx) => {
          await tx
            .insert(issueTable)
            .values(issuesToInsert)
            .onConflictDoUpdate({
              target: [issueTable.nodeId],
              set: conflictUpdateAllExcept(issueTable, [
                "nodeId",
                "id",
                "createdAt",
              ]),
            });
          const issueIds = await tx.$with("issue_ids").as(
            tx
              .select({
                id: issueTable.id,
                nodeId: issueTable.nodeId,
              })
              .from(issueTable),
          );
          const commentsToInsertWithIssueId = commentsToInsert.map(
            ({ issueNodeId, ...comment }) => ({
              ...comment,
              issueId: sql<string>`((SELECT id FROM issue_ids WHERE node_id = ${issueNodeId}))`,
            }),
          );
          await tx
            .with(issueIds)
            .insert(comments)
            .values(commentsToInsertWithIssueId)
            .onConflictDoUpdate({
              target: [comments.nodeId],
              set: conflictUpdateAllExcept(comments, [
                "nodeId",
                "id",
                "createdAt",
              ]),
            });
          await tx
            .update(repos)
            .set({
              issuesLastUpdatedAt: lastIssueUpdatedAt,
            })
            .where(eq(repos.id, repoId));
        });
        console.log(`Loaded ${issues.length} issues for ${repoName}`);
        console.log(
          `Loaded ${commentsToInsert.length} comments for ${repoName}`,
        );
      }
      console.log(`Loaded all issues for ${repoName}`);
    }
  }
}

function mapToCreateIssue(issue: IssueGraphql, repoId: string): CreateIssue {
  return {
    repoId,
    nodeId: issue.id,
    number: issue.number,
    author: issue.author
      ? {
          name: issue.author.login,
          htmlUrl: issue.author.url,
        }
      : null,
    issueState: issue.state,
    issueStateReason: issue.stateReason,
    htmlUrl: issue.url,
    title: issue.title,
    body: issue.body,
    labels: issue.labels.nodes.map((label) => ({
      nodeId: label.id,
      name: label.name,
      color: label.color,
      description: label.description,
    })),
    issueCreatedAt: new Date(issue.createdAt),
    issueUpdatedAt: new Date(issue.updatedAt),
    issueClosedAt: issue.closedAt ? new Date(issue.closedAt) : null,
  };
}

function mapToCreateComment(
  comment: CommentGraphql,
  issueNodeId: string,
): Omit<CreateComment, "issueId"> & {
  issueNodeId: string;
} {
  return {
    issueNodeId,
    nodeId: comment.id,
    author: comment.author
      ? {
          name: comment.author.login,
          htmlUrl: comment.author.url,
        }
      : null,
    body: comment.body,
    commentCreatedAt: new Date(comment.createdAt),
    commentUpdatedAt: new Date(comment.updatedAt),
  };
}
