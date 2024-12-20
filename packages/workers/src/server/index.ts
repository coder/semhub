import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getCORSAllowedOrigins } from "@/auth/auth.constant";
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
    Auth: Service;
  };
  Variables: {
    // user: User | null;
    // session: Session | null;
  };
}

export const app = new Hono<Context>();

app.use("*", async (c, next) => {
  const { currStage } = getDeps();
  return cors({
    origin: getCORSAllowedOrigins(currStage),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

// TODO: move this into a protected endpoint with middleware
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
  .route("/auth", authRouter)
  .route("/search", searchRouter);

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
