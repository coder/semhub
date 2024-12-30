import { Hono } from "hono";

import type { Context } from "@/server/app";

import { githubRouter } from "./github/github.router";

export const webhookRouter = new Hono<Context>().route("/github", githubRouter);
