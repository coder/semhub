import { Hono } from "hono";

import type { Context } from "@/server/app";

import { repoRouter } from "./repo.router";
import { searchRouter } from "./search.router";

export const publicRouter = new Hono<Context>()
  .route("/search", searchRouter)
  .route("/repo", repoRouter);
