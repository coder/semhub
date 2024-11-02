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
    const id = this.env.RATE_LIMITER.idFromName(rateLimiterName);
    const stub = this.env.RATE_LIMITER.get(id);
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
  private requestsPerMinute: number;
  private requestTokens: number;
  private lastRefillTime: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.requestsPerMinute = 10;
    this.requestTokens = this.requestsPerMinute;
    this.lastRefillTime = Date.now();
  }

  setRequestsPerMinute(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
  }

  private refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(
      (timePassed / 60000) * this.requestsPerMinute,
    );

    this.requestTokens = Math.min(
      this.requestsPerMinute,
      this.requestTokens + tokensToAdd,
    );
    this.lastRefillTime = now;
  }

  async getDurationToNextRequest() {
    this.refillTokens();

    if (this.requestTokens >= 1) {
      this.requestTokens -= 1;
      return 0;
    }

    // Calculate wait time until next token is available
    const timeForOneToken = 60000 / this.requestsPerMinute;
    return Math.ceil(timeForOneToken * (1 - this.requestTokens));
  }
}
