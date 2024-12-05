// putting these in a separate file so that migrations can be generated as is
// currently a bug in drizzle-zod vs drizzle-kit interaction
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { authorSchema } from "../shared";
import { issueTable } from "./issue.sql";

export const createIssueSchema = createInsertSchema(issueTable, {
  author: authorSchema,
}).omit({
  id: true,
});

export type CreateIssue = z.infer<typeof createIssueSchema>;

const selectIssueSchema = createSelectSchema(issueTable).extend({
  author: authorSchema,
});

export type SelectIssue = z.infer<typeof selectIssueSchema>;

const _selectIssueForEmbeddingSchema = selectIssueSchema.pick({
  id: true,
  number: true,
  author: true,
  title: true,
  body: true,
  issueState: true,
  issueStateReason: true,
  issueCreatedAt: true,
  issueClosedAt: true,
});

export type SelectIssueForEmbedding = z.infer<
  typeof _selectIssueForEmbeddingSchema
>;
