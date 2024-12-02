import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/wrangler/rate-limiter";
import type { InitSyncParams } from "@/wrangler/workflows/sync-repo/init";
import type { WorkflowWithTypedParams } from "@/wrangler/workflows/sync-repo/util";

import type { ErrorResponse } from "./response";
import { searchRouter } from "./router/searchRouter";

export interface Context extends Env {
  Bindings: {
    RATE_LIMITER: Service<RateLimiterWorker>;
    SYNC_REPO_INIT_WORKFLOW: WorkflowWithTypedParams<InitSyncParams>;
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
  const { db, graphqlOctokit, openai, restOctokit } = getDeps();
  const workflow = c.env.SYNC_REPO_INIT_WORKFLOW;
  await workflow.create({
    id: "",
    params: {
      db,
      repo: {
        name: "semhub",
        owner: "semhub-ai",
      },
      restOctokit,
      graphqlOctokit,
      openai,
    },
  });
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
