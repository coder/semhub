import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { corsConfig } from "@/core/auth/config";
import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import type { Deps } from "@/deps";
import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/wrangler/rate-limiter";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init.workflow";
import { initNextRepos } from "@/wrangler/workflows/sync/repo-init/init.workflow.util";
import type { WorkflowRPC } from "@/wrangler/workflows/workflow.util";

import type { ErrorResponse } from "./response";
import { authRouter } from "./router/auth.router";
import { searchRouter } from "./router/search.router";

export interface Context extends Env {
  Bindings: {
    RATE_LIMITER: Service<RateLimiterWorker>;
    REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>;
  };
  Variables: {
    user: Deps["auth"]["$Infer"]["Session"]["user"] | null;
    session: Deps["auth"]["$Infer"]["Session"]["session"] | null;
  };
}

export const app = new Hono<Context>();

// CORS middleware - Apply before any other middleware
app.use("*", async (c, next) => {
  const { currStage } = getDeps();
  const currentCorsConfig = corsConfig[currStage === "prod" ? "prod" : "dev"];

  return cors({
    origin: currentCorsConfig.origins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

// Auth middleware to handle session
app.use("*", async (c, next) => {
  const { auth } = getDeps();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }
  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

// TODO: remove before merging/deploying
app.post("/create-repo", async (c) => {
  const { owner, name } = await c.req.json<{ owner: string; name: string }>();

  const { db, restOctokit, emailClient } = getDeps();
  const data = await Github.getRepo(name, owner, restOctokit);
  const createdRepo = await Repo.createRepo(data, db);
  if (createdRepo.initStatus !== "ready") {
    return c.json({
      success: true,
      message: "did not trigger workflow",
    });
  }
  const res = await initNextRepos(db, c.env.REPO_INIT_WORKFLOW, emailClient);
  return c.json(res);
});

const _routes = app
  .basePath("/api")
  .route("/search", searchRouter)
  .route("/auth", authRouter);

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
