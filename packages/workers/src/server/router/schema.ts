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
  owner: z.string().min(1).max(39),
  repo: z.string().min(1).max(100),
});

export type RepoSubscribeSchema = z.infer<typeof repoSubscribeSchema>;
