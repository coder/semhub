import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>;
}

// Worker
export default class RateLimiterWorker extends WorkerEntrypoint<Env> {
  async fetch(_request: Request) {
    return new Response(
      JSON.stringify({
        value: await this.getMillisecondsToNextRequest("openai_embedding"),
      }),
    );
  }

  async getMillisecondsToNextRequest(rateLimiterName: string) {
    let id = this.env.RATE_LIMITER.idFromName(rateLimiterName);
    let stub = this.env.RATE_LIMITER.get(id);
    // if greater than 0, wait and retry
    return await stub.getMillisecondsToNextRequest();
  }
}

// Durable Object
export class RateLimiter extends DurableObject {
  // see https://platform.openai.com#free-tier-rate-limits
  // OpenAI rate limits: requests per minute
  // static textEmbedding3Large = 3000;
  static textEmbedding3Large = 60;
  textEmbedding3LargeNextAllowedTime: number;

  constructor(ctx: DurableObjectState, env: Env) {
    // future: initialize using Storage API: https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
    super(ctx, env);
    this.textEmbedding3LargeNextAllowedTime = 0;
  }

  async getMillisecondsToNextRequest() {
    const now = Date.now();
    const millisecondsPerRequest =
      (60 * 1000) / RateLimiter.textEmbedding3Large;

    if (now >= this.textEmbedding3LargeNextAllowedTime) {
      // Only update the next allowed time when we're actually allowing a request
      this.textEmbedding3LargeNextAllowedTime = now + millisecondsPerRequest;
      return 0;
    }
    return this.textEmbedding3LargeNextAllowedTime - now;
  }
}
