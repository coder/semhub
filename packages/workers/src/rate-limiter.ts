import type { RateLimiterName } from "@semhub/core/rate-limiter";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>;
}

// Worker
export default class RateLimiterWorker extends WorkerEntrypoint<Env> {
  async fetch(_request: Request) {
    return new Response(
      JSON.stringify({
        value: await this.getDurationToNextRequest("openai_text_embedding"),
      }),
    );
  }

  // in milliseconds
  // if greater than 0, caller should sleep and try again
  async getDurationToNextRequest(rateLimiterName: RateLimiterName) {
    let id = this.env.RATE_LIMITER.idFromName(rateLimiterName);
    let stub = this.env.RATE_LIMITER.get(id);
    switch (rateLimiterName) {
      case "openai_text_embedding":
        // OpenAI rate limits: requests per minute
        // see https://platform.openai.com#free-tier-rate-limits
        stub.setRequestsPerMinute(3000);
        break;
      default:
        rateLimiterName satisfies never;
        throw new Error(`Unknown rate limiter name: ${rateLimiterName}`);
    }
    return await stub.getDurationToNextRequest();
  }
}

// Durable Object
export class RateLimiter extends DurableObject {
  requestsPerMinute: number;
  nextAllowedTime: number;

  constructor(ctx: DurableObjectState, env: Env) {
    // possible extension: initialize using Storage API: https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
    super(ctx, env);
    this.requestsPerMinute = 10; // low default
    this.nextAllowedTime = 0;
  }

  setRequestsPerMinute(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
  }

  async getDurationToNextRequest() {
    const now = Date.now();
    const millisecondsPerRequest = (60 * 1000) / this.requestsPerMinute;

    if (now >= this.nextAllowedTime) {
      // Only update the next allowed time when we're actually allowing a request
      this.nextAllowedTime = now + millisecondsPerRequest;
      return 0;
    }
    return this.nextAllowedTime - now;
  }
}
