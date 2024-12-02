import { print } from "graphql";

import type { CreateComment } from "@/db/schema/entities/comment.sql";
import type { CreateIssue } from "@/db/schema/entities/issue.schema";
import type { CreateLabel } from "@/db/schema/entities/label.schema";
import type { Repo } from "@/repo";

import { graphql } from "./graphql";
import {
  githubRepoSchema,
  loadIssuesWithCommentsQuerySchema,
  type CommentGraphql,
  type IssueGraphql,
} from "./schema";
import type { GraphqlOctokit, RestOctokit } from "./shared";

export namespace Github {
  export async function getRepo(
    repoName: string,
    repoOwner: string,
    octokit: RestOctokit,
  ) {
    const { data: repoData } = await octokit.rest.repos.get({
      owner: repoOwner,
      repo: repoName,
    });
    const { success, data } = githubRepoSchema.safeParse(repoData);
    if (!success) {
      throw new Error("error parsing repo data from GitHub");
    }
    return data;
  }
  export async function getIssuesCommentsLabels(
    {
      repoId,
      repoName,
      repoOwner,
      issuesLastUpdatedAt,
    }: Awaited<ReturnType<typeof Repo.getReposForCron>>[number],
    octokit: GraphqlOctokit,
  ) {
    const iterator = octokit.graphql.paginate.iterator(getIssueUpsertQuery(), {
      organization: repoOwner,
      repo: repoName,
      cursor: null,
      since: issuesLastUpdatedAt?.toISOString() ?? null,
    });
    let lastIssueUpdatedAt: Date | null = null;
    const rawIssues = [];
    const rawComments = [];
    const rawLabels = [];
    const rawIssueToLabelRelations = [];
    for await (const response of iterator) {
      const { success, data, error } =
        loadIssuesWithCommentsQuerySchema.safeParse(response);
      if (!success) {
        throw new Error("error parsing issues with issues", error);
      }
      const issues = data.repository.issues.nodes;
      if (issues.length === 0) {
        continue;
      }
      lastIssueUpdatedAt = new Date(issues[issues.length - 1]!.updatedAt);
      const issueLabelsToInsert = issues.map((issue) =>
        mapIssuesLabels(issue, repoId),
      );
      const commentsToInsert = issues.flatMap((issue) =>
        issue.comments.nodes.map((comment) =>
          mapCreateComment(comment, issue.id),
        ),
      );

      rawLabels.push(...issueLabelsToInsert.flatMap((entity) => entity.labels));
      rawIssueToLabelRelations.push(
        ...issueLabelsToInsert.flatMap(
          (entity) => entity.issToLblRelationsNodeIds,
        ),
      );
      rawIssues.push(...issueLabelsToInsert.map((entity) => entity.issue));
      rawComments.push(...commentsToInsert);
    }
    // Dedupe labels across all issues
    const nodeIdToLabelMap = new Map<string, CreateLabel>();
    rawLabels.forEach((label) => {
      nodeIdToLabelMap.set(label.nodeId, label);
    });
    const allLabels = Array.from(nodeIdToLabelMap.values());

    // Dedupe issue to label relations across all issues
    const uniqueIssueLabelPairs = new Set<string>();
    rawIssueToLabelRelations.forEach(({ issueNodeId, labelNodeIds }) => {
      labelNodeIds.forEach((labelNodeId) => {
        uniqueIssueLabelPairs.add(`${issueNodeId}:${labelNodeId}`);
      });
    });
    const allIssueToLabelRelations = Array.from(uniqueIssueLabelPairs).map(
      (issueLabelPair) => {
        const [issueNodeId, labelNodeId] = issueLabelPair.split(":") as [
          string,
          string,
        ];
        return { issueNodeId, labelNodeId };
      },
    );

    const allIssues = [
      ...new Map(rawIssues.map((issue) => [issue.nodeId, issue])).values(),
    ];
    const allComments = [
      ...new Map(
        rawComments.map((comment) => [comment.nodeId, comment]),
      ).values(),
    ];

    return {
      issuesToInsert: allIssues,
      commentsToInsert: allComments,
      labelsToInsert: allLabels,
      issueToLabelRelationsToInsertNodeIds: allIssueToLabelRelations,
      lastIssueUpdatedAt,
    };
  }

  interface IssToLblRelationNodeIds {
    issueNodeId: string;
    labelNodeIds: string[];
  }
  function mapIssuesLabels(
    issue: IssueGraphql,
    repoId: string,
  ): {
    issue: CreateIssue;
    labels: CreateLabel[];
    issToLblRelationsNodeIds: IssToLblRelationNodeIds[];
  } {
    const nodeIdToLabel = new Map<string, CreateLabel>();
    issue.labels.nodes.forEach((label) => {
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
    const issueToLabelNodeIds = [
      {
        issueNodeId: issue.id,
        labelNodeIds: dedupedLabels.map((label) => label.nodeId),
      },
    ];
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
      labels: dedupedLabels,
      issToLblRelationsNodeIds: issueToLabelNodeIds,
    };
  }

  function mapCreateComment(
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

  function getIssueUpsertQuery() {
    // use explorer to test GraphQL queries: https://docs.github.com/en/graphql/overview/explorer
    // for extension: get Reactions to body as well as to comments, and aggregate them somehow hmm
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
