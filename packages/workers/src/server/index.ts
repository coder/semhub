import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { getApiServerCORS, getFrontendHomepage } from "@/auth/auth.constant";
import { getDeps } from "@/deps";
import type { User } from "@/subjects";
import type RateLimiterWorker from "@/wrangler/rate-limiter";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init.workflow";
import type { WorkflowRPC } from "@/wrangler/workflows/workflow.util";

import { authMiddleware } from "./middleware/auth.middleware";
import type { ErrorResponse } from "./response";
import { authRouter } from "./router/auth.router";
import { meRouter } from "./router/me.router";
import { publicRouter } from "./router/public.router";

export interface Context extends Env {
  Bindings: {
    RATE_LIMITER: Service<RateLimiterWorker>;
    REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>;
    Auth: Service; // bind via SST, just for the URL, else not used
  };
  Variables: {
    user: User | null;
  };
}

export const app = new Hono<Context>();

app.use("*", async (c, next) => {
  const { currStage } = getDeps();
  return cors(getApiServerCORS(currStage))(c, next);
});

app.get("/", async (c) => {
  const { currStage } = getDeps();
  return c.redirect(getFrontendHomepage(currStage));
});

// something about the ordering has implications for the ApiRoutes type, not super sure
const _routes = app
  // Create the base app with /api prefix
  .basePath("/api")
  // Protected user-specific routes
  .use("/me/*", authMiddleware) // Apply middleware to all /me routes
  .route("/me", meRouter) // Mount the me router
  // Auth routes (no middleware needed)
  .route("/auth", authRouter)
  // Public routes (no middleware needed)
  .route("/public", publicRouter);

// Export the type for client usage
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
