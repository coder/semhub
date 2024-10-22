import { z } from "zod";

export interface Author {
  name: string;
  htmlUrl: string;
}

export interface Label {
  nodeId: string;
  name: string;
  color: string; // hex
  description?: string | null;
}

export const authorSchema: z.ZodType<Author> = z.object({
  name: z.string(),
  htmlUrl: z.string().url(),
});

export const labelSchema: z.ZodType<Label> = z.object({
  nodeId: z.string(),
  name: z.string(),
  color: z.string(), // hex You might want to add a regex for hex color validation
  description: z.string().nullable().optional(),
});
