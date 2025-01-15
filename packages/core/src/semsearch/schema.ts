import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { issueTable } from "../db/schema/entities/issue.sql";
import { selectLabelForSearchSchema } from "../db/schema/entities/label.schema";
import type { SelectRepoForSearch } from "../db/schema/entities/repo.schema";
import { authorSchema } from "../db/schema/shared";

type BaseSearchParams = {
  query: string;
  page: number;
  pageSize: number;
};

type PublicSearchParams = BaseSearchParams & {
  mode: "public";
  lucky?: boolean;
};

type MeSearchParams = BaseSearchParams & {
  mode: "me";
  userId: string;
};

export type SearchParams = PublicSearchParams | MeSearchParams;

const selectRepoForSearchSchemaDuplicated = z.object({
  // can't figure out how to use selectRepoForSearchSchema from repo.schema.ts here
  // after you transform, you lose the .shape property
  // so repeating the fields here
  repoName: z.string(),
  repoOwnerName: z.string(),
  repoUrl: z.string().url(),
  repoLastSyncedAt: z.date().nullable(),
}) satisfies z.ZodType<SelectRepoForSearch>;

// Create a schema that matches exactly what we return in search results
const searchIssueSchema = createSelectSchema(issueTable, {
  author: authorSchema,
})
  .pick({
    id: true,
    number: true,
    title: true,
    author: true,
    issueState: true,
    issueStateReason: true,
    issueCreatedAt: true,
    issueClosedAt: true,
    issueUpdatedAt: true,
  })
  .extend({
    labels: z.array(selectLabelForSearchSchema),
    issueUrl: z.string().url(),
    ...selectRepoForSearchSchemaDuplicated.shape,
    // Search-specific fields
    commentCount: z.number(),
    rankingScore: z.number(),
  })
  .transform((issue) => ({
    ...issue,
  }));

export const searchResultSchema = z.object({
  data: z.array(searchIssueSchema),
  totalCount: z.number(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
