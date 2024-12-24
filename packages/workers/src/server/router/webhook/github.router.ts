import { Hono } from "hono";

import type { Context } from "@/server";

export const githubRouter = new Hono<Context>().post("/", async (c) => {
  // TODO: Implement GitHub webhook handling logic
  return c.json({ success: true, message: "GitHub webhook received" });
});
