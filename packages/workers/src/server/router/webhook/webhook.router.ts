import { Hono } from "hono";

import type { Context } from "@/server";

import { githubRouter } from "./github.router";

export const webhookRouter = new Hono<Context>().route("/github", githubRouter);
