import { z } from "zod";

/* NB there are significant differences between GraphQL and REST:
- unlike REST API, GraphQL API distinguishes between issues and pull requests
- `author` object is nullable in GraphQL, whereas user is non-nullable. this is potentially problematic as it would make normalisation difficult
- `state` is different, GraphQL uses `OPEN` and `CLOSED`, REST includes `deleted`
- state reasons are different, GraphQL includes duplicate
- `isDraft` is only in REST (probably because it's only relevant for pull requests)
- hooked up GitHub GraphQL schema for type inference
*/

// shapes from REST API
export const repoSchema = z
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

export const userEmailsSchema = z.array(
  z.object({
    email: z.string(),
    primary: z.boolean(),
    verified: z.boolean(),
  }),
);

export const githubUserSchema = z
  .object({
    login: z.string(),
    html_url: z.string().url(),
    node_id: z.string(),
    name: z.string(),
    // email: z.string().nullable(), // not relying on this
    avatar_url: z.string().url(),
    company: z.string().nullable(),
    location: z.string().nullable(),
    bio: z.string().nullable(),
    twitter_username: z.string().nullable(),
  })
  .strip();

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
