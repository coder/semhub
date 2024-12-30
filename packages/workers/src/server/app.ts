import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { Resource } from "sst";

import { getApiServerCORS } from "@/auth/auth.constant";
import { getDeps } from "@/deps";
import type { User } from "@/subjects";
import type RateLimiterWorker from "@/wrangler/rate-limiter";
import type { InstallationParams } from "@/wrangler/workflows/background/installation.workflow";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init.workflow";
import type { WorkflowRPC } from "@/wrangler/workflows/workflow.util";

import { authMiddleware } from "./middleware/auth.middleware";
import type { ErrorResponse } from "./response";
import { authRouter } from "./router/auth.router";
import { authzRouter } from "./router/authz.router";
import { meRouter } from "./router/me/me.router";
import { publicRouter } from "./router/public/public.router";
import { webhookRouter } from "./router/webhook/webhook.router";

export interface Context extends Env {
  Bindings: {
    RATE_LIMITER: Service<RateLimiterWorker>; // unused at the moment
    REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>; // used when user subscribes to a new repo
    Auth: Service; // bind via SST, just for the URL, else not used
    INSTALLATION_WORKFLOW: WorkflowRPC<InstallationParams>; // used in webhook processing
  };
  Variables: {
    user: User | null;
  };
}

export interface AuthedContext extends Context {
  Variables: Omit<Context["Variables"], "user"> & {
    user: User;
  };
}

export const app = new Hono<Context>();

// CORS middleware
app.use("*", async (c, next) => {
  const { currStage } = getDeps();
  return cors(getApiServerCORS(currStage))(c, next);
});

// Logger middleware
app.use(logger());

app.get("/", async (c) => {
  return c.redirect("/");
});

// something about the ordering has implications for the ApiRoutes type, not super sure
const _routes = app
  // Create the base app with /api prefix
  .basePath("/api")
  // Protected user-specific routes
  .use("/me/*", authMiddleware) // Apply middleware to all /me routes
  .route("/me", meRouter) // Mount the me router
  // Auth routes
  .route("/auth", authRouter)
  // Authz routes
  .route("/authz", authzRouter)
  // Public routes
  .route("/public", publicRouter)
  // Webhook routes (secured by webhook secret)
  .route("/webhook", webhookRouter);

// Export the type for client usage
export type ApiRoutes = typeof _routes;

app.notFound((c) => {
  return c.json<ErrorResponse>(
    {
      success: false,
      error: `Not Found: ${c.req.path}`,
    },
    404,
  );
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
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
