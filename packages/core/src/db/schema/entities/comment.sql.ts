import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";

import { getBaseColumns, timestamptz } from "../base.sql";
import { authorSchema, type Author } from "../shared";
import { issues } from "./issue.sql";

export const comments = pgTable("comments", {
  ...getBaseColumns("comments"),
  issueId: text("issue_id")
    .references(() => issues.id)
    .notNull(),
  nodeId: text("node_id").notNull().unique(),
  author: jsonb("author").$type<Author>(),
  body: text("body").notNull(),
  commentCreatedAt: timestamptz("comment_created_at").notNull(),
  commentUpdatedAt: timestamptz("comment_updated_at").notNull(),
});

export const createCommentSchema = createInsertSchema(comments, {
  author: authorSchema,
}).omit({
  id: true,
});

export type CreateComment = z.infer<typeof createCommentSchema>;
