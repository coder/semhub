import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { repoValidationSchema } from "@/core/github/schema.validation";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";
import type { Context } from "@/server/app";
import { createSuccessResponse } from "@/server/response";

export const repoRouter = new Hono<Context>().get(
  "/:owner/:repo/status",
  zValidator("param", repoValidationSchema),
  async (c) => {
    const { owner, repo } = c.req.valid("param");
    const { db } = getDeps();
    const res = await Repo.readyForPublicSearch({
      owner,
      name: repo,
      db,
    });
    return c.json(
      createSuccessResponse({
        data: res,
        message: "Successfully retrieved repository status",
      }),
    );
  },
);
