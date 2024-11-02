// TODO: rewrite this as a zod enum and infer this type?
export type RateLimiterName = "openai-text-embedding-3-small";

// return requests per minute (rpm) and tokens per minute (tpm) for now
// ignore tokens per day for now
export function getRateLimits(rateLimiterName: RateLimiterName) {
  // see https://platform.openai.com/docs/guides/rate-limits
  switch (rateLimiterName) {
    case "openai-text-embedding-3-small":
      return { rpm: 3000, tpm: 1000000 };
    default:
      rateLimiterName satisfies never;
      throw new Error(`Unknown rate limiter name: ${rateLimiterName}`);
  }
}
