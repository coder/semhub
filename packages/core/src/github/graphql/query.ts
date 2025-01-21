import { print } from "graphql";
import { z } from "zod";

import { truncateCodeBlocks, truncateToByteSize } from "@/util/truncate";

import { graphql } from "./graphql";

// use explorer to test GraphQL queries: https://docs.github.com/en/graphql/overview/explorer

// Shared schema definitions
const loadRepoIssuesQueryAuthorSchema = z
  .object({
    login: z.string(),
    avatarUrl: z.string().url(),
    url: z.string().url(),
  })
  // when user is deleted, author is null
  .nullable();

// Create a custom string schema with code block truncation
const bodySchema = z.string().transform((text) => {
  const MAX_BODY_SIZE_KB = 5;
  const CODE_BLOCK_PREVIEW_LINES = 6;
  return truncateToByteSize(
    truncateCodeBlocks(text, CODE_BLOCK_PREVIEW_LINES),
    MAX_BODY_SIZE_KB * 1024,
  );
});

const loadRepoIssuesQueryCommentSchema = z.object({
  id: z.string(),
  author: loadRepoIssuesQueryAuthorSchema,
  body: bodySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CommentGraphql = z.infer<typeof loadRepoIssuesQueryCommentSchema>;

// Issues with metadata query and schema
const loadRepoIssuesQueryIssueSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  body: bodySchema,
  url: z.string().url(),
  state: z.enum(["OPEN", "CLOSED"]),
  stateReason: z
    .enum(["COMPLETED", "REOPENED", "NOT_PLANNED", "DUPLICATE"])
    .nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  author: loadRepoIssuesQueryAuthorSchema,
  reactionGroups: z.array(
    z.object({
      content: z.enum([
        "THUMBS_UP",
        "THUMBS_DOWN",
        "LAUGH",
        "HOORAY",
        "CONFUSED",
        "HEART",
        "ROCKET",
        "EYES",
      ]),
      reactors: z.object({
        totalCount: z.number(),
      }),
    }),
  ),
  comments: z.object({
    nodes: z.array(loadRepoIssuesQueryCommentSchema),
  }),
  labels: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        color: z.string(),
        description: z.string().nullable(),
      }),
    ),
  }),
});

export type IssueGraphql = z.infer<typeof loadRepoIssuesQueryIssueSchema>;

export const loadIssuesWithCommentsResSchema = z.object({
  repository: z.object({
    issues: z.object({
      nodes: z.array(loadRepoIssuesQueryIssueSchema),
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        endCursor: z.string().nullable(),
      }),
    }),
  }),
});

export function getQueryGithubIssuesWithMetadata({
  organization,
  repo,
  first,
  since,
  after,
}: {
  organization: string;
  repo: string;
  first: number;
  after: string | null;
  since: Date | null;
}) {
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
  return {
    query: print(query),
    variables: {
      organization,
      repo,
      first,
      since: since?.toISOString() ?? null,
      cursor: after,
    },
  };
}

// Issue numbers query and schema
export const getIssueNumbersResSchema = z.object({
  repository: z.object({
    issues: z.object({
      nodes: z.array(
        z.object({ number: z.number(), updatedAt: z.string().datetime() }),
      ),
    }),
  }),
});

export function getQueryIssueNumbers({
  organization,
  repo,
  first,
  since,
  cursor,
}: {
  organization: string;
  repo: string;
  first: number;
  since: Date | null;
  cursor?: string | null;
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

  return {
    query: print(query),
    variables: {
      organization,
      repo,
      first,
      cursor: cursor ?? null,
      since: since?.toISOString() ?? null,
    },
  };
}

// Issue stats query and schema
export const getIssueStatsResSchema = z.object({
  repository: z.object({
    all: z.object({
      totalCount: z.number(),
    }),
    closed: z.object({
      totalCount: z.number(),
    }),
    open: z.object({
      totalCount: z.number(),
    }),
  }),
});

export function getQueryIssueStats({
  organization,
  repo,
}: {
  organization: string;
  repo: string;
}) {
  const query = graphql(`
    query getIssueStats($organization: String!, $repo: String!) {
      repository(owner: $organization, name: $repo) {
        all: issues {
          totalCount
        }
        closed: issues(states: CLOSED) {
          totalCount
        }
        open: issues(states: OPEN) {
          totalCount
        }
      }
    }
  `);

  return {
    query: print(query),
    variables: {
      organization,
      repo,
    },
  };
}
