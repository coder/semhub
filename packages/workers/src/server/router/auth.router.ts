import { Hono } from "hono";

import { auth } from "@/auth";

export const authRouter = new Hono().on(["POST", "GET"], "/**", (c) =>
  auth.handler(c.req.raw),
);
