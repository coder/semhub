import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { labels } from "./label.sql";

export const createLabelSchema = createInsertSchema(labels).omit({
  id: true,
});

export type CreateLabel = z.infer<typeof createLabelSchema>;

export const selectLabelForEmbeddingSchema = createSelectSchema(labels).pick({
  name: true,
  description: true,
});

export type SelectLabelForEmbedding = z.infer<
  typeof selectLabelForEmbeddingSchema
>;
