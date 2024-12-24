import { z } from "zod";

import { paginationSchema } from "../../response";

export const issuesSearchSchema = paginationSchema.extend({
  q: z.string(),
  // don't use boolean because it will be serialized to string when passed to worker
  // if use boolean, will need two different schemas
  lucky: z.enum(["y", "n"]).optional(),
});

export type IssuesSearchSchema = z.infer<typeof issuesSearchSchema>;
