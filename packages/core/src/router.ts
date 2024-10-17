import { Hono } from "hono";
import type { Env } from "hono";

import { searchRouter } from "./routes/search";

export interface Context extends Env {
  Variables: {
    // user: User | null;
    // session: Session | null;
  };
}

export const app = new Hono<Context>();

// TODO: set up auth and CORS

const routes = app.basePath("/api").route("/search", searchRouter);

export type ApiRoutes = typeof routes;
