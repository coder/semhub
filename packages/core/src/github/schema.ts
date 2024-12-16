import { z } from "zod";

import { truncateCodeBlocks, truncateToByteSize } from "@/util";

// shape from GitHub GraphQL API
export const loadRepoIssuesQueryAuthorSchema = z
  .object({
    login: z.string(),
    url: z.string().url(),
  })
  // when user is deleted, author is null
  .nullable();

// Create a custom string schema with code block truncation
export const bodySchema = z.string().transform((text) => {
  const MAX_BODY_SIZE_KB = 5;
  const CODE_BLOCK_PREVIEW_LINES = 6;
  return truncateToByteSize(
    truncateCodeBlocks(text, CODE_BLOCK_PREVIEW_LINES),
    MAX_BODY_SIZE_KB * 1024,
  );
});

export const loadRepoIssuesQueryCommentSchema = z.object({
  id: z.string(),
  author: loadRepoIssuesQueryAuthorSchema,
  body: bodySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CommentGraphql = z.infer<typeof loadRepoIssuesQueryCommentSchema>;

export const loadRepoIssuesQueryIssueSchema = z.object({
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

export const getIssueNumbersResSchema = z.object({
  repository: z.object({
    issues: z.object({
      nodes: z.array(
        z.object({ number: z.number(), updatedAt: z.string().datetime() }),
      ),
    }),
  }),
});

/* NB there are significant differences between GraphQL and REST:
- unlike REST API, GraphQL API distinguishes between issues and pull requests
- `author` object is nullable in GraphQL, whereas user is non-nullable. this is potentially problematic as it would make normalisation difficult
- `state` is different, GraphQL uses `OPEN` and `CLOSED`, REST includes `deleted`
- state reasons are different, GraphQL includes duplicate
- `isDraft` is only in REST (probably because it's only relevant for pull requests)
- hooked up GitHub GraphQL schema for type inference
*/

// shape from REST API
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

// export const githubUserSchema = z
//   .object({
//     login: z.string(),
//     html_url: z.string().url(),
//     node_id: z.string(),
//   })
//   .strip();

// export const githubLabelSchema = z
//   .object({
//     node_id: z.string(),
//     name: z.string(),
//     color: z.string(),
//     description: z.string().nullable().optional(),
//   })
//   .strip();

// export const githubCommentSchema = z.object({
//   author: githubUserSchema,
//   body: z.string(),
//   created_at: z.string().datetime(),
//   updated_at: z.string().datetime(),
// });

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
