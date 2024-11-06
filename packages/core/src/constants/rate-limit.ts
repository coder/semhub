// OpenAI model name
export const EMBEDDING_MODEL = "text-embedding-3-small";

export type RateLimiterName = typeof EMBEDDING_MODEL;

export interface RateLimiter {
  getDurationToNextRequest: (
    rateLimiterName: RateLimiterName,
  ) => Promise<number>;
}

// return requests per minute (rpm) and tokens per minute (tpm) for now
// ignore tokens per day for now
export function getRateLimits(rateLimiterName: RateLimiterName) {
  // see https://platform.openai.com/docs/guides/rate-limits
  switch (rateLimiterName) {
    case EMBEDDING_MODEL:
      return { rpm: 3000, tpm: 1000000 };
    default:
      rateLimiterName satisfies never;
      throw new Error(`Unknown rate limiter name: ${rateLimiterName}`);
  }
}
