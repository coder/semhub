import { print } from "graphql";

import type { CreateComment } from "@/db/schema/entities/comment.sql";
import type { CreateIssue } from "@/db/schema/entities/issue.schema";
import type { CreateLabel } from "@/db/schema/entities/label.schema";
import type { AggregateReactions } from "@/db/schema/shared";

import { graphql } from "./graphql";
import {
  getIssueNumbersResSchema,
  loadIssuesWithCommentsResSchema,
  type CommentGraphql,
  type IssueGraphql,
} from "./schema.graphql";
import { repoSchema } from "./schema.rest";
import type { GraphqlOctokit, RestOctokit } from "./shared";

export async function getGithubRepoById({
  githubRepoId,
  octokit,
}: {
  githubRepoId: string | number;
  octokit: RestOctokit;
}) {
  try {
    // see https://github.com/octokit/octokit.js/issues/163
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

export async function getGithubRepo({
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

interface IssToLblRelationNodeIds {
  issueNodeId: string;
  labelNodeIds: string[];
}

function normalizeDataPerIssue(
  issue: IssueGraphql,
  repoId: string,
): {
  issue: CreateIssue;
  labels: CreateLabel[];
  issToLblRelationsNodeIds: IssToLblRelationNodeIds[];
} {
  // Aggregate reactions by type
  const reactionCounts = issue.reactionGroups.reduce(
    (acc: Record<string, number>, reaction) => {
      acc[reaction.content] = reaction.reactors.totalCount;
      return acc;
    },
    {},
  );

  const aggregateReactions: AggregateReactions = {
    THUMBS_UP: reactionCounts.THUMBS_UP || 0,
    THUMBS_DOWN: reactionCounts.THUMBS_DOWN || 0,
    LAUGH: reactionCounts.LAUGH || 0,
    HOORAY: reactionCounts.HOORAY || 0,
    CONFUSED: reactionCounts.CONFUSED || 0,
    HEART: reactionCounts.HEART || 0,
    ROCKET: reactionCounts.ROCKET || 0,
    EYES: reactionCounts.EYES || 0,
  };

  // Return null if all reactions are 0
  const hasReactions = Object.values(aggregateReactions).some(
    (count) => count > 0,
  );
  const finalAggregateReactions = hasReactions ? aggregateReactions : null;

  // Get top 5 commenters by frequency
  const commentFrequency = issue.comments.nodes
    .filter((comment) => comment.author != null)
    .reduce((acc, comment) => {
      const author = comment.author!;
      const key = author.login;
      if (!acc.has(key)) {
        acc.set(key, {
          count: 0,
          name: author.login,
          htmlUrl: author.url,
          avatarUrl: author.avatarUrl,
        });
      }
      acc.get(key)!.count++;
      return acc;
    }, new Map<string, { count: number; name: string; htmlUrl: string; avatarUrl: string }>());

  const topCommenters = Array.from(commentFrequency.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ name, htmlUrl, avatarUrl }) => ({
      name,
      htmlUrl,
      avatarUrl,
    }));

  // Return null if no commenters
  const finalTopCommenters = topCommenters.length > 0 ? topCommenters : null;

  const labels = issue.labels.nodes.map((label) => ({
    nodeId: label.id,
    name: label.name,
    color: label.color,
    description: label.description,
    issueId: issue.id,
  }));

  // we need this for the many-to-many relationship in our SQL
  const issueToLabelNodeIds = [
    {
      issueNodeId: issue.id,
      labelNodeIds: labels.map((label) => label.nodeId),
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
            avatarUrl: issue.author.avatarUrl,
          }
        : null,
      issueState: issue.state,
      issueStateReason: issue.stateReason,
      htmlUrl: issue.url,
      title: issue.title,
      body: issue.body,
      aggregateReactions: finalAggregateReactions,
      topCommenters: finalTopCommenters,
      issueCreatedAt: new Date(issue.createdAt),
      issueUpdatedAt: new Date(issue.updatedAt),
      issueClosedAt: issue.closedAt ? new Date(issue.closedAt) : null,
    },
    labels,
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
          avatarUrl: comment.author.avatarUrl,
        }
      : null,
    body: comment.body,
    commentCreatedAt: new Date(comment.createdAt),
    commentUpdatedAt: new Date(comment.updatedAt),
  };
}

function getGithubIssuesWithMetadataForUpsert() {
  // use explorer to test GraphQL queries: https://docs.github.com/en/graphql/overview/explorer
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
              avatarUrl
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
            reactionGroups {
              content
              reactors {
                totalCount
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
                  avatarUrl
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

export async function getLatestGithubRepoIssues({
  repoId,
  repoName,
  repoOwner,
  octokit,
  since,
  after,
  numIssues = 100,
}: {
  repoId: string;
  repoName: string;
  repoOwner: string;
  octokit: GraphqlOctokit;
  since: Date | null;
  after: string | null;
  numIssues?: number;
}) {
  const response = await octokit.graphql(
    getGithubIssuesWithMetadataForUpsert(),
    {
      organization: repoOwner,
      repo: repoName,
      since: since?.toISOString() ?? null,
      first: numIssues,
      cursor: after,
    },
  );
  const data = loadIssuesWithCommentsResSchema.parse(response);
  const issues = data.repository.issues.nodes;
  const hasNextPage = data.repository.issues.pageInfo.hasNextPage;
  const endCursor = data.repository.issues.pageInfo.endCursor;
  if (issues.length === 0) {
    return {
      hasNextPage,
      endCursor,
      lastIssueUpdatedAt: null,
      issuesAndCommentsLabels: {
        issuesToInsert: [],
        commentsToInsert: [],
        labelsToInsert: [],
        issueToLabelRelationsToInsertNodeIds: [],
      },
    };
  }
  const normalizedIssues = issues.map((issue) =>
    normalizeDataPerIssue(issue, repoId),
  );
  const rawIssues = normalizedIssues.map((entity) => entity.issue);
  const rawComments = issues.flatMap((issue) =>
    issue.comments.nodes.map((comment) => mapCreateComment(comment, issue.id)),
  );
  const rawLabels = normalizedIssues.flatMap((entity) => entity.labels);
  const rawIssueToLabelRelations = normalizedIssues.flatMap(
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

  const issuesNodeIdMap = [
    ...new Map(rawIssues.map((issue) => [issue.nodeId, issue])).values(),
  ];
  const commentsNodeIdMap = [
    ...new Map(
      rawComments.map((comment) => [comment.nodeId, comment]),
    ).values(),
  ];

  if (!endCursor) {
    throw new Error("endCursor is not supposed to be null");
  }
  const lastIssueUpdatedAt = new Date(issues[issues.length - 1]!.updatedAt);
  return {
    hasNextPage,
    endCursor,
    issuesAndCommentsLabels: {
      issuesToInsert: issuesNodeIdMap,
      commentsToInsert: commentsNodeIdMap,
      labelsToInsert: allLabels,
      issueToLabelRelationsToInsertNodeIds: allIssueToLabelRelations,
    },
    lastIssueUpdatedAt,
  };
}

/**
 * @deprecated Use getLatestGithubRepoIssues instead
 * Could consider calling from a beefy local machine/server
 */
export async function getGithubIssuesViaIterator(
  {
    repoId,
    repoName,
    repoOwner,
    repoIssuesLastUpdatedAt,
    after,
  }: {
    repoId: string;
    repoName: string;
    repoOwner: string;
    repoIssuesLastUpdatedAt: Date | null;
    after: string | null;
  },
  octokit: GraphqlOctokit,
  numIssues = 100,
) {
  const iterator = octokit.graphql.paginate.iterator(
    getGithubIssuesWithMetadataForUpsert(),
    {
      organization: repoOwner,
      repo: repoName,
      cursor: after,
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
      normalizeDataPerIssue(issue, repoId),
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

export async function getGithubIssuesArrayToChunk({
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
