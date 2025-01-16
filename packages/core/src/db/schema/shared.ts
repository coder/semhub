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

export const aggregateReactionsSchema = z.object({
  THUMBS_UP: z.number(),
  THUMBS_DOWN: z.number(),
  LAUGH: z.number(),
  HOORAY: z.number(),
  CONFUSED: z.number(),
  HEART: z.number(),
  ROCKET: z.number(),
  EYES: z.number(),
});

export type AggregateReactions = z.infer<typeof aggregateReactionsSchema>;

export const topCommentersSchema = z.array(
  z.object({
    name: z.string(),
    htmlUrl: z.string().url(),
    avatarUrl: z.string().url(),
  }),
);

export type TopCommenters = z.infer<typeof topCommentersSchema>;
