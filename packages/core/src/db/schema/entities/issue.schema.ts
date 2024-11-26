// putting these in a separate file so that migrations can be generated as is
// currently a bug in drizzle-zod vs drizzle-kit interaction
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { authorSchema } from "../shared";
import { issues } from "./issue.sql";

export const createIssueSchema = createInsertSchema(issues, {
  author: authorSchema,
  // TODO: DELETE
  labels: z
    .array(
      z.object({
        nodeId: z.string(),
        name: z.string(),
        color: z.string(),
        description: z.string().nullable(),
      }),
    )
    .optional(),
}).omit({
  id: true,
});

export type CreateIssue = z.infer<typeof createIssueSchema>;

type A = CreateIssue["labels"];

const selectIssueSchema = createSelectSchema(issues).extend({
  author: authorSchema,
});

const selectIssueForEmbedding = selectIssueSchema.pick({
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

export type SelectIssueForEmbedding = z.infer<typeof selectIssueForEmbedding>;
