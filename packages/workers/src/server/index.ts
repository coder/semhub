import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/wrangler/rate-limiter";
import type { InitSyncParams } from "@/wrangler/workflows/sync-repo/init";
import type { RPCWorkflow } from "@/wrangler/workflows/sync-repo/util";

import type { ErrorResponse } from "./response";
import { searchRouter } from "./router/searchRouter";

export interface Context extends Env {
  Bindings: {
    RATE_LIMITER: Service<RateLimiterWorker>;
    SYNC_REPO_INIT_WORKFLOW: RPCWorkflow<InitSyncParams>;
  };
  Variables: {
    // user: User | null;
    // session: Session | null;
  };
}

export const app = new Hono<Context>();

// TODO: set up auth
app.use("*", cors());

// TODO: delete before merging
app.get("/test", async (c) => {
  const { db } = getDeps();
  const repos = await Repo.getReposForCron(db);
  console.log("repos", repos);
  return c.json({
    success: true,
    repos,
  });
});

const _routes = app.basePath("/api").route("/search", searchRouter);

export type ApiRoutes = typeof _routes;

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
