import { Hono } from "hono";

import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { Context } from "../router";

export const searchRouter = new Hono<Context>().get(
  "/",
  zValidator(
    "query",
    z.object({
      q: z.string(),
    }),
  ),
  async (c) => {
    const { q: query } = c.req.valid("query");
    return c.text(query);
  },
);
