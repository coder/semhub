import type { ExportedHandler } from "@cloudflare/workers-types";
import * as Sentry from "@sentry/cloudflare";
import { Resource } from "sst";

import type { Context } from "./server/app";
import { app } from "./server/app";

type CloudflareRequest<T = unknown> = Request<T, CfProperties<T>>;
const handler: ExportedHandler<Context> = {
  async fetch(request, env, ctx) {
    // needed to fix type error
    return app.fetch(request as CloudflareRequest, env, ctx);
  },
};

// Wrap with Sentry
export default Sentry.withSentry(
  () => ({
    dsn: "https://d415d30f99a3f43649f2289a054fe5b2@o4508764596142080.ingest.us.sentry.io/4508764598829056",
    tracesSampleRate: 1.0,
    debug: true,
    environment: Resource.App.stage,
  }),
  handler,
);
