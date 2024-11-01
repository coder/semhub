// putting these in a separate file so that migrations can be generated as is
// currently a bug in drizzle-zod vs drizzle-kit interaction
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { authorSchema, labelSchema } from "../shared";
import { issues } from "./issue.sql";

export const createIssueSchema = createInsertSchema(issues, {
  author: authorSchema,
  labels: z.array(labelSchema).optional(),
}).omit({
  id: true,
});

export type CreateIssue = z.infer<typeof createIssueSchema>;

const selectIssueSchema = createSelectSchema(issues).extend({
  author: authorSchema,
  labels: z.array(labelSchema).nullable(),
});

const selectIssueForEmbedding = selectIssueSchema.pick({
  number: true,
  author: true,
  title: true,
  body: true,
  issueState: true,
  issueStateReason: true,
  labels: true,
  issueCreatedAt: true,
  issueClosedAt: true,
});

export type IssueFieldsForEmbedding = z.infer<typeof selectIssueForEmbedding>;
