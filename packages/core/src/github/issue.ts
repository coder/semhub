import { print } from "graphql";

import { eq, getDb, sql } from "@/db";
import { conflictUpdateAllExcept } from "@/db/helper";
import { comments, type CreateComment } from "@/db/schema/entities/comment.sql";
import { issuesToLabels } from "@/db/schema/entities/issue-to-label.sql";
import type { CreateIssue } from "@/db/schema/entities/issue.schema";
import { issues as issueTable } from "@/db/schema/entities/issue.sql";
import type { CreateLabel } from "@/db/schema/entities/label.schema";
import { labels as labelTable } from "@/db/schema/entities/label.sql";
import { repos } from "@/db/schema/entities/repo.sql";

import { graphql } from "./graphql";
import {
  loadIssuesWithCommentsQuerySchema,
  type CommentGraphql,
  type IssueGraphql,
} from "./schema";
import { getGraphqlOctokit } from "./shared";

export namespace GitHubIssue {
  // TODO: add rate limiter for calling GitHub API?
  // TODO: add embedding sync logic to this function to ensure eventual consistency
  export async function sync() {
    const octokit = getGraphqlOctokit();
    // general strategy: one repo at a time, ensure idempotency, interruptible, minimise redoing work, update if conflict
    const { db } = getDb();
    const coderRepos = await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
      })
      .from(repos)
      .where(eq(repos.owner, "coder"));
    outerLoop: for (const {
      repoId,
      repoName,
      issuesLastUpdatedAt,
    } of coderRepos) {
      const iterator = octokit.graphql.paginate.iterator(
        getIssueUpsertQuery(),
        {
          organization: "coder",
          repo: repoName,
          cursor: null,
          since: issuesLastUpdatedAt ? issuesLastUpdatedAt.toISOString() : null,
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
        const entitiesToInsert = issues.map((issue) =>
          mapToCreateEntities(issue, repoId),
        );
        const commentsToInsert = issues.flatMap((issue) =>
          issue.comments.nodes.map((comment) =>
            mapToCreateComment(comment, issue.id),
          ),
        );
        const labelsToInsert = entitiesToInsert.flatMap(
          (entity) => entity.dedupedLabels,
        );
        const issToLblRelationsNodeIds = entitiesToInsert.flatMap(
          (entity) => entity.issToLblRelationsNodeIds,
        );
        const issuesToInsert = entitiesToInsert.map((entity) => entity.issue);
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
          await tx
            .insert(labelTable)
            .values(labelsToInsert)
            .onConflictDoUpdate({
              target: [labelTable.nodeId],
              set: conflictUpdateAllExcept(labelTable, [
                "nodeId",
                "id",
                "createdAt",
              ]),
            });
          const issueIds = tx.$with("issue_ids").as(
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
          if (commentsToInsertWithIssueId.length > 0) {
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
          }
          const labelIds = tx.$with("label_ids").as(
            tx
              .select({
                id: labelTable.id,
                nodeId: labelTable.nodeId,
              })
              .from(labelTable),
          );
          const issueToLabelRelationsToInsert = issToLblRelationsNodeIds.map(
            ({ issueNodeId, labelNodeIds }) => ({
              issueId: sql<string>`((SELECT id FROM issue_ids WHERE node_id = ${issueNodeId}))`,
              labelId: sql<string>`((SELECT id FROM label_ids WHERE node_id = ${labelNodeIds}))`,
            }),
          );
          if (issueToLabelRelationsToInsert.length > 0) {
            await tx
              .with(labelIds)
              .insert(issuesToLabels)
              .values(issueToLabelRelationsToInsert);
          }
          await tx
            .update(repos)
            .set({
              issuesLastUpdatedAt: lastIssueUpdatedAt,
            })
            .where(eq(repos.id, repoId));
        });
        console.log(`Synced ${issues.length} issues for ${repoName}`);
        console.log(
          `Synced ${commentsToInsert.length} comments for ${repoName}`,
        );
      }
      console.log(`Synced all issues for ${repoName}`);
    }
  }
  interface IssToLblRelationNodeIds {
    issueNodeId: string;
    labelNodeIds: string[];
  }
  function mapToCreateEntities(
    issue: IssueGraphql,
    repoId: string,
  ): {
    issue: CreateIssue;
    dedupedLabels: CreateLabel[];
    issToLblRelationsNodeIds: IssToLblRelationNodeIds[];
  } {
    const nodeIdToLabel = new Map<string, CreateLabel>();
    issue.labels.nodes.map((label) => {
      const newLabel = {
        nodeId: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
        issueId: issue.id,
      };
      // since we are updating from oldest to newest, we want later label to always overwrite earlier ones
      nodeIdToLabel.set(label.id, newLabel);
    });
    const dedupedLabels = Array.from(nodeIdToLabel.values());
    const issueToLabelNodeIds = dedupedLabels.map((label) => ({
      issueNodeId: issue.id,
      labelNodeIds: [label.nodeId],
    }));
    return {
      issue: {
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
        issueCreatedAt: new Date(issue.createdAt),
        issueUpdatedAt: new Date(issue.updatedAt),
        issueClosedAt: issue.closedAt ? new Date(issue.closedAt) : null,
      },
      dedupedLabels,
      issToLblRelationsNodeIds: issueToLabelNodeIds,
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

  export function getIssueUpsertQuery() {
    // use explorer to test GraphQL queries: https://docs.github.com/en/graphql/overview/explorer
    const query = graphql(`
      query paginate(
        $cursor: String
        $organization: String!
        $repo: String!
        $since: DateTime
      ) {
        repository(owner: $organization, name: $repo) {
          issues(
            first: 100
            after: $cursor
            orderBy: { field: UPDATED_AT, direction: ASC }
            filterBy: { since: $since }
          ) {
            nodes {
              id
              number
              title
              body
              url
              state
              stateReason
              createdAt
              updatedAt
              closedAt
              author {
                login
                url
              }
              labels(first: 10) {
                nodes {
                  id
                  name
                  color
                  description
                }
              }
              comments(
                first: 100
                orderBy: { field: UPDATED_AT, direction: ASC }
              ) {
                nodes {
                  id
                  author {
                    login
                    url
                  }
                  body
                  createdAt
                  updatedAt
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `);
    return print(query);
  }
}
