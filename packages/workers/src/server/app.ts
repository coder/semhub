import * as Sentry from "@sentry/cloudflare";
import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { Resource } from "sst";

import { getApiServerCORS } from "@/auth/auth.constant";
import type { User } from "@/auth/subjects";
import { getDeps } from "@/deps";
import type { InstallationParams } from "@/wrangler/workflows/background/installation.workflow";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init.workflow";
import type { WorkflowRPC } from "@/wrangler/workflows/workflow.util";

import { authMiddleware } from "./middleware/auth.middleware";
import type { ErrorResponse } from "./response";
import { authRouter } from "./router/auth.router";
import { authzRouter } from "./router/authz.router";
import { meRouter } from "./router/me/me.router";
import { publicRouter } from "./router/public/public.router";
import { sentryRouter } from "./router/sentry.router";
import { webhookRouter } from "./router/webhook/webhook.router";

export interface Context extends Env {
  Bindings: {
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
  .route("/webhook", webhookRouter)
  // Sentry tunnel route
  .route("/sentry", sentryRouter);

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
    // Don't report 4xx errors to Sentry as they are client errors
    return c.json<ErrorResponse>(
      {
        success: false,
        error: err.message,
      },
      err.status,
    );
  }

  const isProd = Resource.App.stage === "prod";

  // Add request context to Sentry
  Sentry.setContext("request", {
    method: c.req.method,
    url: c.req.url,
    headers: c.req.header(),
  });

  // Add user context if available
  const user = c.get("user");
  if (user) {
    Sentry.setUser({
      id: user.id,
    });
  }

  // Group similar errors together using fingerprinting
  Sentry.withScope((scope) => {
    // Create a fingerprint based on:
    // 1. Error name/type
    // 2. HTTP method
    // 3. Request path pattern (removing dynamic segments)
    // 4. Error message (if it's a known type)
    const errorType = err.name || "Error";
    const pathPattern = c.req.path.replace(/\/[0-9a-fA-F-]+/g, "/:id");

    scope.setFingerprint([
      errorType,
      c.req.method,
      pathPattern,
      err instanceof Error ? err.message : "Unknown Error",
    ]);

    // Capture exception with extra context
    Sentry.captureException(err, {
      tags: {
        stage: Resource.App.stage,
      },
      extra: {
        path: c.req.path,
        query: Object.fromEntries(new URL(c.req.url).searchParams),
      },
    });
  });

  return c.json<ErrorResponse>(
    {
      success: false,
      error: isProd ? "Internal Server Error" : (err.stack ?? err.message),
    },
    500,
  );
});
