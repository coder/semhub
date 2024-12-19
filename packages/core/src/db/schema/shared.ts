import { z } from "zod";

// deleted GitHub account will be null
export type Author = {
  name: string;
  htmlUrl: string;
} | null;

export const authorSchema: z.ZodType<Author> = z
  .object({
    name: z.string(),
    htmlUrl: z.string().url(),
  })
  .nullable();
