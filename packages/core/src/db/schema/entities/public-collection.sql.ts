import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { getBaseColumns } from "../base.sql";

export const publicCollections = pgTable("public_collections", {
  ...getBaseColumns("public_collections"),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const createPublicCollectionSchema = createInsertSchema(
  publicCollections,
  {
    name: (schema) => schema.name.min(1),
  },
).omit({
  id: true,
});
