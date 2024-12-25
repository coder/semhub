import { eq } from "drizzle-orm";

import type { DbClient } from "@/db";
import { organizations } from "@/db/schema/entities/organization.sql";
import { users } from "@/db/schema/entities/user.sql";

export namespace Installation {
  export function mapGithubTargetType(githubType: "Organization" | "User") {
    switch (githubType) {
      case "Organization":
        return "organization" as const;
      case "User":
        return "user" as const;
      default:
        githubType satisfies never;
        throw new Error(`Unexpected GitHub target type: ${githubType}`);
    }
  }

  export async function getTargetId({
    targetType,
    nodeId,
    db,
  }: {
    targetType: "Organization" | "User";
    nodeId: string;
    db: DbClient;
  }) {
    switch (targetType) {
      case "Organization": {
        const [org] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.nodeId, nodeId));
        return org?.id ?? null;
      }
      case "User": {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.nodeId, nodeId));
        return user?.id ?? null;
      }
      default:
        targetType satisfies never;
        throw new Error(`Not supported target type: ${targetType}`);
    }
  }

  export async function getInstallerUserId({
    nodeId,
    installerType,
    db,
  }: {
    nodeId: string;
    installerType: "User" | "Organization" | "Bot";
    db: DbClient;
  }) {
    switch (installerType) {
      case "User": {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.nodeId, nodeId));
        return user?.id ?? null;
      }
      case "Bot":
      case "Organization": {
        throw new Error(`Not supported installer type: ${installerType}`);
      }
      default:
        installerType satisfies never;
        throw new Error(`Unexpected installer type: ${installerType}`);
    }
  }
}
