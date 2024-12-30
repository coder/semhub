import { Hono } from "hono";

import type { AuthedContext } from "@/server/app";

import { installationRouter } from "./installation.router";
import { repoRouter } from "./repo.router";
import { searchRouter } from "./search.router";

export const meRouter = new Hono<AuthedContext>()
  .route("/repos", repoRouter)
  .route("/installations", installationRouter)
  .route("/search", searchRouter);
