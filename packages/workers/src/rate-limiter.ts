import {
  getRateLimits,
  type RateLimiterName,
} from "@semhub/core/constants/rate-limit";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>;
}

// Worker
export default class RateLimiterWorker extends WorkerEntrypoint<Env> {
  // just for testing, not used in practice
  async fetch(_request: Request) {
    return new Response(
      JSON.stringify({
        value: await this.getDurationToNextRequest(
          "openai-text-embedding-3-small",
        ),
      }),
    );
  }

  // in milliseconds. if greater than 0, caller should sleep and try again
  async getDurationToNextRequest(rateLimiterName: RateLimiterName) {
    const id = this.env.RATE_LIMITER.idFromName(rateLimiterName);
    const stub = this.env.RATE_LIMITER.get(id);
    // TODO: implement TPM rate limit. let's see whether we hit this in practice?
    const { rpm } = getRateLimits(rateLimiterName);
    stub.setRequestsPerMinute(rpm);
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
