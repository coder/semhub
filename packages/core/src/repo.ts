import type { DbClient } from "@/db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "@/db";
import { comments } from "@/db/schema/entities/comment.sql";
import { issuesToLabels } from "@/db/schema/entities/issue-to-label.sql";
import { issueTable } from "@/db/schema/entities/issue.sql";
import { labels as labelTable } from "@/db/schema/entities/label.sql";
import { repos } from "@/db/schema/entities/repo.sql";
import { usersToRepos } from "@/db/schema/entities/user-to-repo.sql";
import { conflictUpdateOnly } from "@/db/utils/conflict";
import { sanitizeForPg } from "@/db/utils/string";

import { issueEmbeddings } from "./db/schema/entities/issue-embedding.sql";
import type { getGithubRepo, getLatestGithubRepoIssues } from "./github";

export const Repo = {
  exists: async ({
    owner,
    name,
    db,
  }: {
    owner: string;
    name: string;
    db: DbClient;
  }) => {
    const [result] = await db
      .select({
        id: repos.id,
        isPrivate: repos.isPrivate,
      })
      .from(repos)
      .where(and(eq(repos.ownerLogin, owner), eq(repos.name, name)));
    if (!result) {
      return {
        exists: false,
      } as const;
    }
    return {
      exists: true,
      id: result.id,
      isPrivate: result.isPrivate,
    } as const;
  },

  createRepo: async ({
    data,
    db,
    defaultInitStatus = "ready",
  }: {
    data: NonNullable<Awaited<ReturnType<typeof getGithubRepo>>["data"]>;
    db: DbClient;
    defaultInitStatus?: "ready" | "pending";
  }) => {
    const {
      owner: { login: ownerLogin, avatar_url: ownerAvatarUrl },
      name,
      node_id: nodeId,
      html_url: htmlUrl,
      private: isPrivate,
    } = data;
    const [result] = await db
      .insert(repos)
      .values({
        ownerLogin,
        ownerAvatarUrl,
        name,
        nodeId,
        htmlUrl,
        isPrivate,
        initStatus: defaultInitStatus,
      })
      .onConflictDoUpdate({
        target: [repos.nodeId],
        set: conflictUpdateOnly(repos, [
          "ownerLogin",
          "ownerAvatarUrl",
          "name",
          "htmlUrl",
          "isPrivate",
          "updatedAt",
        ]),
      })
      .returning({
        id: repos.id,
        initStatus: repos.initStatus,
        repoName: repos.name,
        repoOwner: repos.ownerLogin,
      });
    if (!result) {
      throw new Error("Failed to create repo");
    }
    return result;
  },

  markNextEnqueuedRepoInProgress: async (db: DbClient) => {
    // wrapped in a single transaction to prevent race condition
    return await db.transaction(async (tx) => {
      const [repo] = await tx
        .select({
          repoId: repos.id,
          repoName: repos.name,
          repoOwner: repos.ownerLogin,
          isPrivate: repos.isPrivate,
          repoIssuesLastUpdatedAt: repos.issuesLastUpdatedAt,
        })
        .from(repos)
        .where(
          and(
            eq(repos.initStatus, "completed"),
            eq(repos.syncStatus, "queued"),
          ),
        )
        // nulls first index ensure nulls are picked first
        .orderBy(asc(repos.lastSyncedAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!repo) {
        return null;
      }
      await tx
        .update(repos)
        .set({ syncStatus: "in_progress" })
        .where(eq(repos.id, repo.repoId));
      return repo;
    });
  },

  enqueueReposForIssueSync: async (db: DbClient) => {
    return await db
      .update(repos)
      .set({
        syncStatus: "queued",
      })
      .where(
        and(
          eq(repos.initStatus, "completed"),
          eq(repos.syncStatus, "ready"),
          or(
            isNull(repos.lastSyncedAt),
            // this needs to be set with consideration to CRON_PATTERN
            lt(repos.lastSyncedAt, sql`NOW() - INTERVAL '10 minutes'`),
          ),
        ),
      )
      .returning({
        repoId: repos.id,
      });
  },

  unstuckReposForInit: async (db: DbClient) => {
    await db
      .update(repos)
      .set({ initStatus: "ready" })
      .where(
        and(
          eq(repos.initStatus, "in_progress"),
          lt(repos.updatedAt, sql`NOW() - INTERVAL '1 hour'`),
        ),
      );
  },

  unstuckReposForIssueSync: async (db: DbClient) => {
    await db
      .update(repos)
      .set({ syncStatus: "ready" })
      .where(
        and(
          eq(repos.syncStatus, "in_progress"),
          lt(repos.lastSyncedAt, sql`NOW() - INTERVAL '1 hour'`),
        ),
      );
  },

  upsertIssuesCommentsLabels: async (
    {
      issuesToInsert,
      commentsToInsert,
      labelsToInsert,
      issueToLabelRelationsToInsertNodeIds,
    }: Awaited<
      ReturnType<typeof getLatestGithubRepoIssues>
    >["issuesAndCommentsLabels"],
    db: DbClient,
  ) => {
    const sanitizedIssuesToInsert = issuesToInsert.map((issue) => ({
      ...issue,
      title: sanitizeForPg(issue.title),
      body: sanitizeForPg(issue.body),
    }));
    if (sanitizedIssuesToInsert.length === 0) {
      return [];
    }
    const sanitizedCommentsToInsert = commentsToInsert.map((comment) => ({
      ...comment,
      body: sanitizeForPg(comment.body),
    }));
    const sanitizedLabelsToInsert = labelsToInsert.map((label) => ({
      ...label,
      description: label.description ? sanitizeForPg(label.description) : null,
    }));

    return await db.transaction(async (tx) => {
      const insertedIssueIds = await tx
        .insert(issueTable)
        .values(sanitizedIssuesToInsert)
        .onConflictDoUpdate({
          target: [issueTable.nodeId],
          set: conflictUpdateOnly(issueTable, [
            "author",
            "number",
            "issueState",
            "htmlUrl",
            "issueStateReason",
            "title",
            "body",
            "issueCreatedAt",
            "issueUpdatedAt",
            "issueClosedAt",
            "updatedAt",
          ]),
        })
        .returning({
          id: issueTable.id,
        });
      if (labelsToInsert.length > 0) {
        await tx
          .insert(labelTable)
          .values(sanitizedLabelsToInsert)
          .onConflictDoUpdate({
            target: [labelTable.nodeId],
            set: conflictUpdateOnly(labelTable, [
              "name",
              "color",
              "description",
              "updatedAt",
            ]),
          });
      }
      const issueIds = tx.$with("issue_ids").as(
        tx
          .select({
            id: issueTable.id,
            nodeId: issueTable.nodeId,
          })
          .from(issueTable),
      );
      const sanitizedCommentsToInsertWithIssueId =
        sanitizedCommentsToInsert.map(({ issueNodeId, ...comment }) => ({
          ...comment,
          issueId: sql<string>`((SELECT id FROM issue_ids WHERE node_id = ${issueNodeId}))`,
        }));
      if (sanitizedCommentsToInsertWithIssueId.length > 0) {
        await tx
          .with(issueIds)
          .insert(comments)
          .values(sanitizedCommentsToInsertWithIssueId)
          .onConflictDoUpdate({
            target: [comments.nodeId],
            set: conflictUpdateOnly(comments, [
              "body",
              "author",
              "commentCreatedAt",
              "commentUpdatedAt",
              "updatedAt",
            ]),
          });
      }
      const labelIds = tx.$with("label_ids").as(
        tx
          .select({
            id: labelTable.id,
            nodeId: labelTable.nodeId,
          })
          .from(labelTable),
      );
      const issueToLabelRelationsToInsert =
        issueToLabelRelationsToInsertNodeIds.map(
          ({ issueNodeId, labelNodeId }) => ({
            issueId: sql<string>`((SELECT id FROM issue_ids WHERE node_id = ${issueNodeId}))`,
            labelId: sql<string>`((SELECT id FROM label_ids WHERE node_id = ${labelNodeId}))`,
          }),
        );
      if (issueToLabelRelationsToInsert.length > 0) {
        await tx
          .with(labelIds, issueIds)
          .insert(issuesToLabels)
          .values(issueToLabelRelationsToInsert)
          .onConflictDoUpdate({
            target: [issuesToLabels.issueId, issuesToLabels.labelId],
            set: conflictUpdateOnly(issuesToLabels, ["updatedAt"]),
          });
      }
      return insertedIssueIds.map(({ id }) => id);
    });
  },

  getInitInProgressCount: async (db: DbClient) => {
    const [countRes] = await db
      .select({
        count: count(),
      })
      .from(repos)
      .where(eq(repos.initStatus, "in_progress"));

    return countRes?.count ?? 0;
  },

  getInitReadyRepos: async (db: DbClient, numRepos: number) => {
    const result = await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        repoOwner: repos.ownerLogin,
      })
      .from(repos)
      .where(eq(repos.initStatus, "ready"))
      // always initialize earliest created repo first
      .orderBy(asc(repos.createdAt))
      .limit(numRepos);

    return result;
  },

  markInitInProgress: async (db: DbClient, repoIds: string[]) => {
    await db
      .update(repos)
      .set({ initStatus: "in_progress" })
      .where(inArray(repos.id, repoIds));
  },

  getSubscribedRepos: async (userId: string, db: DbClient) => {
    return db
      .select({
        id: repos.id,
        ownerName: repos.ownerLogin,
        ownerAvatarUrl: repos.ownerAvatarUrl,
        name: repos.name,
        htmlUrl: repos.htmlUrl,
        isPrivate: repos.isPrivate,
        initStatus: repos.initStatus,
        syncStatus: repos.syncStatus,
        lastSyncedAt: repos.lastSyncedAt,
        issueLastUpdatedAt: repos.issuesLastUpdatedAt,
        repoSubscribedAt: usersToRepos.subscribedAt,
      })
      .from(repos)
      .innerJoin(usersToRepos, eq(repos.id, usersToRepos.repoId))
      .where(
        and(
          eq(usersToRepos.userId, userId),
          eq(usersToRepos.status, "active"),
          ne(repos.initStatus, "pending"),
        ),
      )
      .orderBy(desc(usersToRepos.subscribedAt));
  },

  setPrivateRepoToReady: async (repoId: string, db: DbClient) => {
    await db
      .update(repos)
      .set({ initStatus: "ready" })
      .where(eq(repos.id, repoId));
  },

  setIssuesLastUpdatedAt: async (repoId: string, db: DbClient) => {
    const [result] = await db
      .select({
        lastUpdated: issueTable.issueUpdatedAt,
      })
      .from(issueTable)
      // only count issues that have embeddings
      .innerJoin(issueEmbeddings, eq(issueEmbeddings.issueId, issueTable.id))
      .where(eq(issueTable.repoId, repoId))
      .orderBy(desc(issueTable.issueUpdatedAt))
      .limit(1);
    if (!result) {
      return;
    }
    await db
      .update(repos)
      .set({ issuesLastUpdatedAt: result.lastUpdated })
      .where(eq(repos.id, repoId));
  },

  readyForPublicSearch: async ({
    owner,
    name,
    db,
  }: {
    owner: string;
    name: string;
    db: DbClient;
  }) => {
    const [result] = await db
      .select({
        initStatus: repos.initStatus,
        syncStatus: repos.syncStatus,
        lastSyncedAt: repos.lastSyncedAt,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
        avatarUrl: repos.ownerAvatarUrl,
      })
      .from(repos)
      .where(
        and(
          eq(repos.ownerLogin, owner),
          eq(repos.name, name),
          eq(repos.isPrivate, false),
        ),
      );

    if (!result) {
      return null;
    }

    return {
      initStatus: result.initStatus,
      lastSyncedAt: result.lastSyncedAt,
      issuesLastUpdatedAt: result.issuesLastUpdatedAt,
      syncStatus: result.syncStatus,
      avatarUrl: result.avatarUrl,
    };
  },
};
