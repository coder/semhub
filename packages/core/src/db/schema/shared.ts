import { z } from "zod";

// deleted GitHub account will be null
export type Author = {
  name: string;
  htmlUrl: string;
} | null;

export interface Label {
  nodeId: string;
  name: string;
  color: string; // hex
  description: string | null;
}

export const authorSchema: z.ZodType<Author> = z
  .object({
    name: z.string(),
    htmlUrl: z.string().url(),
  })
  .nullable();
