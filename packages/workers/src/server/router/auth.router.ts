import { Hono } from "hono";

import { getDeps } from "@/deps";

export const authRouter = new Hono().on(["POST", "GET"], "/**", (c) => {
  const { auth } = getDeps();
  return auth.handler(c.req.raw);
});
