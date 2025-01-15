import { z } from "zod";

import { searchResultSchema } from "./schema";

// NB used in generate-go.ts to generate structs in Golang

export const lambdaSearchRequestSchema = z.object({
  embedding: z.array(z.number()),
  sqlQuery: z.string(),
});

export const lambdaErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export const lambdaSuccessResponseSchema = searchResultSchema.extend({
  success: z.literal(true),
});

export const lambdaResponseSchema = z.union([
  lambdaErrorResponseSchema,
  lambdaSuccessResponseSchema,
]);

export type LambdaSearchRequest = z.infer<typeof lambdaSearchRequestSchema>;
export type LambdaErrorResponse = z.infer<typeof lambdaErrorResponseSchema>;
export type LambdaResponse = z.infer<typeof lambdaResponseSchema>;
