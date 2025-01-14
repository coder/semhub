import { z } from "zod";

export const lambdaSearchRequestSchema = z.object({
  query: z.string(),
  embedding: z.array(z.number()),
});

export const lambdaErrorResponseSchema = z.object({
  message: z.string(),
  error: z.string().optional(),
});

export const lambdaSuccessResponseSchema = z.object({
  message: z.string(),
});

export const lambdaResponseSchema = z.union([
  lambdaErrorResponseSchema,
  lambdaSuccessResponseSchema,
]);

// TypeScript type exports
export type LambdaSearchRequest = z.infer<typeof lambdaSearchRequestSchema>;
export type LambdaErrorResponse = z.infer<typeof lambdaErrorResponseSchema>;
export type LambdaSuccessResponse = z.infer<typeof lambdaSuccessResponseSchema>;
export type LambdaResponse = z.infer<typeof lambdaResponseSchema>;
