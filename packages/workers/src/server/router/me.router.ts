import { initNextRepos } from "@semhub/wrangler/workflows/sync/repo-init/init.workflow.util";
import { Hono } from "hono";

import { Github } from "@/core/github";
import { Repo } from "@/core/repo";
import { getDeps } from "@/deps";

import type { Context } from "..";

export const meRouter = new Hono<Context>().post("/repos/add", async (c) => {
  const { owner, name } = await c.req.json<{ owner: string; name: string }>();
  // const user = c.get("user"); // Get authenticated user from context

  const { db, restOctokit, emailClient } = getDeps();
  const data = await Github.getRepo(name, owner, restOctokit);
  const createdRepo = await Repo.createRepo(data, db);
  if (createdRepo.initStatus !== "ready") {
    return c.json({
      success: true,
      message: "did not trigger workflow",
    });
  }
  const res = await initNextRepos(db, c.env.REPO_INIT_WORKFLOW, emailClient);
  return c.json(res);
});
