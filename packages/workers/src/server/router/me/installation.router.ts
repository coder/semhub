import { Hono } from "hono";

import { CURRENT_REQUESTED_PERMISSIONS } from "@/core/github/permission/github-app";
import { Installation } from "@/core/installation";
import { getDeps } from "@/deps";
import type { AuthedContext } from "@/server";
import { createSuccessResponse } from "@/server/response";

export const installationRouter = new Hono<AuthedContext>().get(
  "/status",
  async (c) => {
    const user = c.get("user");
    const { db } = getDeps();
    const hasValidInstallation = await Installation.userHasValidInstallation({
      userId: user.id,
      requiredPermissions: CURRENT_REQUESTED_PERMISSIONS,
      db,
    });
    return c.json(
      createSuccessResponse({
        data: { hasValidInstallation },
        message: "Successfully checked installation validity",
      }),
    );
  },
);
