import { z } from "zod";

import { searchQuerySchema } from "@/core/semsearch/schema.input";

import { paginationSchema } from "../../response";

export const meSearchSchema = paginationSchema.extend({
  q: searchQuerySchema,
});

export type MeSearchSchema = z.infer<typeof meSearchSchema>;

export const publicSearchSchema = meSearchSchema.extend({
  // don't use boolean because it will be serialized to string when passed to worker
  // if use boolean, will need two different schemas
  lucky: z.enum(["y", "n"]).optional().catch("n"),
});

export type PublicSearchSchema = z.infer<typeof publicSearchSchema>;
