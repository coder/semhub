import { print } from "graphql";

import type { CreateComment } from "@/db/schema/entities/comment.sql";
import type { CreateIssue } from "@/db/schema/entities/issue.schema";
import type { CreateLabel } from "@/db/schema/entities/label.schema";

import { graphql } from "./graphql";
import {
  getIssueNumbersResSchema,
  loadIssuesWithCommentsResSchema,
  type CommentGraphql,
  type IssueGraphql,
} from "./schema.graphql";
import { repoSchema } from "./schema.rest";
import type { GraphqlOctokit, RestOctokit } from "./shared";

export namespace Github {
  export async function getRepoById({
    githubRepoId,
    octokit,
  }: {
    githubRepoId: string | number;
    octokit: RestOctokit;
  }) {
    try {
      const { data } = await octokit.request("GET /repositories/:id", {
        id: githubRepoId,
      });
      const repoData = repoSchema.parse(data);
      return {
        exists: true,
        data: repoData,
      };
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 404) {
        return {
          exists: false,
          data: null,
        };
      }
      throw error;
    }
  }
  export async function getRepo({
    repoName,
    repoOwner,
    octokit,
  }: {
    repoName: string;
    repoOwner: string;
    octokit: RestOctokit;
  }) {
    try {
      const { data: repoData } = await octokit.rest.repos.get({
        owner: repoOwner,
        repo: repoName,
      });
      const repoDataParsed = repoSchema.parse(repoData);
      return {
        exists: true,
        data: repoDataParsed,
      } as const;
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 404) {
        return {
          exists: false,
          data: null,
        } as const;
      }
      throw error;
    }
  }
  export async function getLatestRepoIssues({
    repoId,
    repoName,
    repoOwner,
    octokit,
    since,
    after,
    numIssues = 100, // max 100
  }: {
    repoId: string;
    repoName: string;
    repoOwner: string;
    octokit: GraphqlOctokit;
    since: Date | null;
    after: string | null;
    numIssues?: number;
  }) {
    const response = await octokit.graphql(getIssuesWithMetadataForUpsert(), {
      organization: repoOwner,
      repo: repoName,
      cursor: after,
      since: since?.toISOString() ?? null,
      first: numIssues,
    });
    const data = loadIssuesWithCommentsResSchema.parse(response);
    const issues = data.repository.issues.nodes;
    const hasNextPage = data.repository.issues.pageInfo.hasNextPage;
    const endCursor = data.repository.issues.pageInfo.endCursor;
    if (issues.length === 0) {
      return {
        hasNextPage,
        endCursor,
        issuesAndCommentsLabels: {
          issuesToInsert: [],
          commentsToInsert: [],
          labelsToInsert: [],
          issueToLabelRelationsToInsertNodeIds: [],
        },
      };
    }
    const issueLabelsToInsert = issues.map((issue) =>
      mapIssuesLabels(issue, repoId),
    );
    const rawIssues = issueLabelsToInsert.map((entity) => entity.issue);
    const rawComments = issues.flatMap((issue) =>
      issue.comments.nodes.map((comment) =>
        mapCreateComment(comment, issue.id),
      ),
    );
    const rawLabels = issueLabelsToInsert.flatMap((entity) => entity.labels);
    const rawIssueToLabelRelations = issueLabelsToInsert.flatMap(
      (entity) => entity.issToLblRelationsNodeIds,
    );
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

    const lastIssueUpdatedAt = new Date(issues[issues.length - 1]!.updatedAt);
    return {
      hasNextPage,
      endCursor,
      issuesAndCommentsLabels: {
        issuesToInsert: allIssues,
        commentsToInsert: allComments,
        labelsToInsert: allLabels,
        issueToLabelRelationsToInsertNodeIds: allIssueToLabelRelations,
      },
      lastIssueUpdatedAt,
    };
  }
  /**
   * @deprecated Use getLatestRepoIssues instead
   * Could consider calling from a beefy local machine/server
   */
  export async function getIssuesViaIterator(
    {
      repoId,
      repoName,
      repoOwner,
      repoIssuesLastUpdatedAt,
    }: {
      repoId: string;
      repoName: string;
      repoOwner: string;
      repoIssuesLastUpdatedAt: Date | null;
    },
    octokit: GraphqlOctokit,
    numIssues = 100,
  ) {
    const iterator = octokit.graphql.paginate.iterator(
      getIssuesWithMetadataForUpsert(),
      {
        organization: repoOwner,
        repo: repoName,
        cursor: null,
        since: repoIssuesLastUpdatedAt?.toISOString() ?? null,
        first: numIssues,
      },
    );
    let lastIssueUpdatedAt: Date | null = null;
    const rawIssues = [];
    const rawComments = [];
    const rawLabels = [];
    const rawIssueToLabelRelations = [];
    for await (const response of iterator) {
      const data = loadIssuesWithCommentsResSchema.parse(response);
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
      issuesAndCommentsLabels: {
        issuesToInsert: allIssues,
        commentsToInsert: allComments,
        labelsToInsert: allLabels,
        issueToLabelRelationsToInsertNodeIds: allIssueToLabelRelations,
      },
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

  function getIssuesWithMetadataForUpsert() {
    // use explorer to test GraphQL queries: https://docs.github.com/en/graphql/overview/explorer
    // for extension: get Reactions to body as well as to comments, and aggregate them somehow hmm
    const query = graphql(`
      query paginate(
        $cursor: String
        $organization: String!
        $repo: String!
        $since: DateTime
        $first: Int!
      ) {
        repository(owner: $organization, name: $repo) {
          issues(
            first: $first
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

  export async function getIssuesArrayToChunk({
    repoOwner,
    repoName,
    octokit,
    since,
    numIssuesPerQuery,
  }: {
    repoOwner: string;
    repoName: string;
    octokit: GraphqlOctokit;
    since: Date | null;
    numIssuesPerQuery: number;
  }) {
    const query = graphql(`
      query getIssueNumbers(
        $cursor: String
        $organization: String!
        $repo: String!
        $since: DateTime
        $first: Int!
      ) {
        repository(owner: $organization, name: $repo) {
          issues(
            first: $first
            after: $cursor
            orderBy: { field: UPDATED_AT, direction: ASC }
            filterBy: { since: $since }
          ) {
            nodes {
              number
              updatedAt
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `);
    // actually, collecting the issue numbers is unnecessary
    const allIssueNumbers: Array<{ number: number; updatedAt: Date }> = [];
    const iterator = octokit.graphql.paginate.iterator(print(query), {
      organization: repoOwner,
      repo: repoName,
      since: since?.toISOString() ?? null,
      first: numIssuesPerQuery,
    });
    for await (const response of iterator) {
      const data = getIssueNumbersResSchema.parse(response);
      allIssueNumbers.push(
        ...data.repository.issues.nodes.map((n) => ({
          number: n.number,
          updatedAt: new Date(n.updatedAt),
        })),
      );
    }
    return allIssueNumbers;
  }
}
