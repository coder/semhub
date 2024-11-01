import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

export interface Env {
  COUNTERS: DurableObjectNamespace<RateLimiter>;
}

// Worker
export default class RateLimiterWorker extends WorkerEntrypoint<Env> {
  async fetch(_: Request) {
    return new Response(
      JSON.stringify({ value: await this.getCounterValue("test") }),
    );
  }

  async increment(name: string) {
    let id = this.env.COUNTERS.idFromName(name);
    let stub = this.env.COUNTERS.get(id);
    return await stub.increment();
  }

  async decrement(name: string) {
    let id = this.env.COUNTERS.idFromName(name);
    let stub = this.env.COUNTERS.get(id);
    return await stub.decrement();
  }

  async getCounterValue(name: string) {
    let id = this.env.COUNTERS.idFromName(name);
    let stub = this.env.COUNTERS.get(id);
    return await stub.getCounterValue();
  }
}

export class RateLimiter extends DurableObject {
  async fetch(_: Request) {
    return new Response(
      JSON.stringify({ value: await this.getCounterValue() }),
    );
  }

  async getCounterValue() {
    let value = (await this.ctx.storage.get("value")) || 0;
    return value;
  }

  async increment(amount = 1) {
    let value: number = (await this.ctx.storage.get("value")) || 0;
    value += amount;
    await this.ctx.storage.put("value", value);
    return value;
  }

  async decrement(amount = 1) {
    let value: number = (await this.ctx.storage.get("value")) || 0;
    value -= amount;
    await this.ctx.storage.put("value", value);
    return value;
  }
}
