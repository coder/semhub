import { Hono } from "hono";

import { getDeps } from "@/deps";
import type { Context } from "@/server";

import { createSuccessResponse } from "../response";

export const authzRouter = new Hono<Context>().get("/authorize", async (c) => {
  const { githubAppPublicLink } = getDeps();
  const url = `${githubAppPublicLink}/installations/new`;

  return c.json(
    createSuccessResponse({
      data: { url },
      message: "Successfully generated GitHub App installation URL",
    }),
  );
});
