import { z } from "zod";

import { paginationSchema } from "../response";

// need to be in separate file for use in web, to avoid importing server-only dependencies
export const issuesSearchSchema = paginationSchema.extend({
  q: z.string(),
  // don't use boolean because it will be serialized to string when passed to worker
  // if use boolean, will need two different schemas
  lucky: z.enum(["y", "n"]).optional(),
});

export type IssuesSearchSchema = z.infer<typeof issuesSearchSchema>;

export const repoSubscribeSchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(39)
    .regex(
      /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/,
      "Username must contain only alphanumeric characters or single hyphens, and cannot begin or end with a hyphen",
    ),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-zA-Z0-9._][a-zA-Z0-9._-]*$/,
      "Repository name cannot start with a dot/hyphen and can only contain letters, numbers, dots, hyphens, and underscores",
    )
    .refine(
      (name) => !name.endsWith(".git"),
      "Repository name cannot end with .git",
    ),
});

export type RepoSubscribeSchema = z.infer<typeof repoSubscribeSchema>;
