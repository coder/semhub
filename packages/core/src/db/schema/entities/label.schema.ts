import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { labels } from "./label.sql";

const _createLabelSchema = createInsertSchema(labels).omit({
  id: true,
});

export type CreateLabel = z.infer<typeof _createLabelSchema>;

const _selectLabelForEmbeddingSchema = createSelectSchema(labels).pick({
  name: true,
  description: true,
});

export type SelectLabelForEmbedding = z.infer<
  typeof _selectLabelForEmbeddingSchema
>;
