import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { EMBEDDING_MODEL } from "@/core/constants/rate-limit";
import type RateLimiterWorker from "@/wrangler/rate-limiter/index";
import type { SyncParams } from "@/wrangler/workflow/sync";
import type { WorkflowWithTypedParams } from "@/wrangler/workflow/utils";

import type { ErrorResponse } from "./response";
import { searchRouter } from "./router/searchRouter";

export interface Context extends Env {
  Bindings: {
    RATE_LIMITER: Service<RateLimiterWorker>;
    SYNC_WORKFLOW: WorkflowWithTypedParams<SyncParams>;
  };
  Variables: {
    // user: User | null;
    // session: Session | null;
  };
}

export const app = new Hono<Context>();

// TODO: set up auth
app.use("*", cors());

app.get("/test", async (c) => {
  const duration =
    await c.env.RATE_LIMITER.getDurationToNextRequest(EMBEDDING_MODEL);
  console.log(duration);
  console.log(typeof duration);
  return c.json({ duration });
});

const routes = app.basePath("/api").route("/search", searchRouter);

export type ApiRoutes = typeof routes;

app.onError((err, c) => {
  if (err instanceof HTTPException && err.res) {
    return c.json<ErrorResponse>(
      {
        success: false,
        error: err.message,
        // isFormError:
        //   err.cause && typeof err.cause === "object" && "form" in err.cause
        //     ? err.cause.form === true
        //     : false,
      },
      err.status,
    );
  }
  const isProd = Resource.App.stage === "prod";
  return c.json<ErrorResponse>(
    {
      success: false,
      error: isProd ? "Internal Server Error" : (err.stack ?? err.message),
    },
    500,
  );
});
