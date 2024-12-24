import { and, eq } from "drizzle-orm";

import type { DbClient } from "@/db";
import { usersToRepos } from "@/db/schema/entities/user-to-repo.sql";
import { users } from "@/db/schema/entities/user.sql";
import type { GithubScopes, UserMetadata } from "@/db/schema/entities/user.sql";
import { conflictUpdateOnly } from "@/db/utils/conflict";
import { githubUserSchema, userEmailsSchema } from "@/github/schema.rest";
import { getRestOctokit } from "@/github/shared";

import { GITHUB_SCOPES_PERMISSION } from "./github/permission";

export namespace User {
  export async function getByEmail(email: string, db: DbClient) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user ?? null;
  }

  export async function upsert({
    accessToken,
    db,
    githubScopes,
  }: {
    accessToken: string;
    db: DbClient;
    githubScopes: GithubScopes;
  }) {
    const octokit = getRestOctokit(accessToken);
    const { data: userData } = await octokit.rest.users.getAuthenticated();
    const userDataParsed = githubUserSchema.parse(userData);
    const {
      login,
      html_url: htmlUrl,
      node_id: nodeId,
      name,
      avatar_url: avatarUrl,
      company,
      location,
      bio,
    } = userDataParsed;
    const { data: emailsData } =
      await octokit.rest.users.listEmailsForAuthenticatedUser();
    const emailsDataParsed = userEmailsSchema.parse(emailsData);
    const email = emailsDataParsed.find((email) => email.primary)?.email;
    const userMetadata: UserMetadata = {
      company,
      location,
      bio,
      emails: emailsDataParsed.map((data) => data.email),
    };
    if (!email) {
      throw new Error("no primary email found");
    }
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        avatarUrl,
        accessToken,
        nodeId,
        login,
        htmlUrl,
        githubScopes,
        metadata: userMetadata,
      })
      .onConflictDoUpdate({
        target: [users.nodeId],
        set: conflictUpdateOnly(users, [
          "name",
          "avatarUrl",
          "githubScopes",
          "accessToken",
          "metadata",
          "htmlUrl",
          "login",
          "email",
        ]),
      })
      .returning({
        id: users.id,
      });
    if (!user) {
      throw new Error("error upserting user");
    }
    return {
      userId: user.id,
      primaryEmail: email,
      avatarUrl,
      name,
    };
  }
  export async function subscribeRepo({
    repoId,
    userId,
    db,
  }: {
    repoId: string;
    userId: string;
    db: DbClient;
  }) {
    await db
      .insert(usersToRepos)
      .values({
        repoId,
        userId,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [usersToRepos.userId, usersToRepos.repoId],
        set: conflictUpdateOnly(usersToRepos, ["status", "subscribedAt"]),
      });
  }
  export async function unsubscribeRepo({
    repoId,
    userId,
    db,
  }: {
    repoId: string;
    userId: string;
    db: DbClient;
  }) {
    await db
      .update(usersToRepos)
      .set({ status: "inactive", unsubscribedAt: new Date() })
      .where(
        and(eq(usersToRepos.userId, userId), eq(usersToRepos.repoId, repoId)),
      );
  }
  export async function checkAuthorizedRepo(
    userId: string,
    db: DbClient,
  ): Promise<boolean> {
    const repoScope = GITHUB_SCOPES_PERMISSION.repo;
    const [user] = await db
      .select({ githubScopes: users.githubScopes })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.githubScopes) {
      return false;
    }

    return user.githubScopes.includes(repoScope);
  }
}
