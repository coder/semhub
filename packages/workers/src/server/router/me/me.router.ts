import { Hono } from "hono";

import type { AuthedContext } from "@/server";

import { repoRouter } from "./repo.router";

export const meRouter = new Hono<AuthedContext>().route("/repos", repoRouter);
