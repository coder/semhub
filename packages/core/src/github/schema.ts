import gql from "graphql-tag";
import { z } from "zod";

// unlike REST API, GraphQL API distinguishes between issues and pull requests
export const loadIssuesWithCommentsQuery = ({
  since,
}: {
  since: Date | null;
}) => gql`
  query paginate($cursor: String, $organization: String!, $repo: String!) {
    repository(owner: $organization, name: $repo) {
      issues(
        first: 100
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: ASC }
        filterBy: { since: ${since ? `"${since.toISOString()}"` : "null"} }
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
          comments(first: 20, orderBy: { field: UPDATED_AT, direction: ASC }) {
            nodes {
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
`;

export const githubIssueQuerySchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  url: z.string().url(),
  state: z.enum(["OPEN", "CLOSED"]),
  stateReason: z
    .enum(["COMPLETED", "REOPENED", "NOT_PLANNED", "DUPLICATE"])
    .nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  author: z.object({
    login: z.string(),
    url: z.string().url(),
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

export type GitHubIssue = z.infer<typeof githubIssueQuerySchema>;

export const loadIssuesWithCommentsQuerySchema = z.object({
  repository: z.object({
    issues: z.object({
      nodes: z.array(githubIssueQuerySchema),
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        endCursor: z.string(),
      }),
    }),
  }),
});

export const githubRepoSchema = z
  .object({
    owner: z
      .object({
        login: z.string(),
      })
      .strip(),
    name: z.string(),
    node_id: z.string(),
    html_url: z.string().url(),
    private: z.boolean(),
  })
  .strip();

export const githubUserSchema = z
  .object({
    login: z.string(),
    html_url: z.string().url(),
    node_id: z.string(),
  })
  .strip();

export const githubLabelSchema = z
  .object({
    node_id: z.string(),
    name: z.string(),
    color: z.string(),
    description: z.string().nullable().optional(),
  })
  .strip();

export const githubCommentSchema = z.object({
  author: githubUserSchema,
  body: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// shape from REST API
// export const githubIssueSchema = z
//   .object({
//     node_id: z.string(),
//     number: z.number(),
//     title: z.string(),
//     state: z.enum(["open", "closed"]),
//     user: githubUserSchema,
//     pull_request: z.object({}).optional(),
//     created_at: z.string().datetime(),
//     updated_at: z.string().datetime(),
//     closed_at: z.string().datetime().nullable(),
//     labels: z.array(githubLabelSchema),
//     html_url: z.string().url(),
//     body: z.string().nullable(),
//     draft: z.boolean().optional(),
//     state_reason: z.enum(["completed", "reopened", "not_planned"]).nullable(),
//     comments: z.array(githubCommentSchema),
//   })
//   .strip();
