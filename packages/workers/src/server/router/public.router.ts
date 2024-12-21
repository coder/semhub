import { Hono } from "hono";

import type { Context } from "..";
import { searchRouter } from "./search.router";

export const publicRouter = new Hono<Context>().route("/search", searchRouter);
