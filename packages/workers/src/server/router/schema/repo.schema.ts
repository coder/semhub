import { z } from "zod";

export const repoIssueCountsSchema = z.object({
  allIssuesCount: z.coerce.number(),
  closedIssuesCount: z.coerce.number(),
  openIssuesCount: z.coerce.number(),
});

export type RepoIssueCountsSchema = z.infer<typeof repoIssueCountsSchema>;
