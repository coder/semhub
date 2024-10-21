import { z } from "zod";

// there are many more fields, but we are only validating the ones we are storing
export const githubUserSchema = z.object({
  login: z.string(),
  html_url: z.string().url(),
  node_id: z.string(),
});

export const githubLabelSchema = z.object({
  node_id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
});

export const githubIssueSchema = z.object({
  node_id: z.string(),
  number: z.number(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  user: githubUserSchema,
  pull_request: z.object({}).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable(),
  labels: z.array(githubLabelSchema),
  html_url: z.string().url(),
  body: z.string().nullable(),
  draft: z.boolean().optional(),
  state_reason: z.enum(["completed", "reopened", "not_planned"]).nullable(),
});

export type GitHubIssue = z.infer<typeof githubIssueSchema>;

