import type { WorkflowRPC } from "@semhub/wrangler/workflows/sync/util";
import { Hono } from "hono";
import type { Env } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Resource } from "sst";

import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type RateLimiterWorker from "@/wrangler/rate-limiter";
import type { RepoInitParams } from "@/wrangler/workflows/sync/repo-init/init";
import { initNextRepo } from "@/wrangler/workflows/sync/repo-init/init.util";

import type { ErrorResponse } from "./response";
import { searchRouter } from "./router/searchRouter";

export interface Context extends Env {
  Bindings: {
    RATE_LIMITER: Service<RateLimiterWorker>;
    REPO_INIT_WORKFLOW: WorkflowRPC<RepoInitParams>;
  };
  Variables: {
    // user: User | null;
    // session: Session | null;
  };
}

export const app = new Hono<Context>();

// TODO: set up auth
app.use("*", cors());

// TODO: remove before merging/deploying
app.get("/create-repo", async (c) => {
  const params = {
    owner: "vercel",
    name: "next.js",
  };
  const { db, restOctokit } = getDeps();
  const data = await Github.getRepo(params.name, params.owner, restOctokit);
  const createdRepo = await Repo.createRepo(data, db);
  if (createdRepo.initStatus !== "ready") {
    return c.json({
      success: true,
      message: "did not trigger workflow",
    });
  }
  const res = await initNextRepo(db, c.env.REPO_INIT_WORKFLOW);
  return c.json(res);
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
