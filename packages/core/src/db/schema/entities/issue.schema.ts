// putting these in a separate file so that migrations can be generated as is
// currently a bug in drizzle-zod vs drizzle-kit interaction
import { createInsertSchema } from "drizzle-zod";
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
