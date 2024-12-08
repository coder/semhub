import type { DbClient } from "@/db";
import { and, asc, count, eq, isNull, lt, or, sql } from "@/db";
import { comments } from "@/db/schema/entities/comment.sql";
import { issuesToLabels } from "@/db/schema/entities/issue-to-label.sql";
import { issueTable } from "@/db/schema/entities/issue.sql";
import { labels as labelTable } from "@/db/schema/entities/label.sql";
import { repos } from "@/db/schema/entities/repo.sql";
import { conflictUpdateOnly } from "@/db/utils/conflict";
import { sanitizeForPg } from "@/db/utils/string";
import type { Github } from "@/github";

export namespace Repo {
  export async function createRepo(
    data: Awaited<ReturnType<typeof Github.getRepo>>,
    db: DbClient,
  ) {
    const {
      owner: { login: owner },
      name,
      node_id: nodeId,
      html_url: htmlUrl,
      private: isPrivate,
    } = data;
    const [result] = await db
      .insert(repos)
      .values({
        owner,
        name,
        nodeId,
        htmlUrl,
        isPrivate,
      })
      .onConflictDoUpdate({
        target: [repos.nodeId],
        set: conflictUpdateOnly(repos, [
          "owner",
          "name",
          "htmlUrl",
          "isPrivate",
          "updatedAt",
        ]),
      })
      .returning({
        repoId: repos.id,
        initStatus: repos.initStatus,
        repoName: repos.name,
        repoOwner: repos.owner,
      });
    if (!result) {
      throw new Error("Failed to create repo");
    }
    return result;
  }
  export async function getNextRepoForIssueSync(db: DbClient) {
    const [repo] = await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        repoOwner: repos.owner,
        repoIssuesLastUpdatedAt: repoIssuesLastUpdatedSql(repos),
      })
      .from(repos)
      .where(
        and(eq(repos.initStatus, "completed"), eq(repos.syncStatus, "queued")),
      )
      .orderBy(asc(repos.lastSyncedAt))
      .limit(1);
    if (!repo) {
      return null;
    }
    return repo;
  }
  export async function selectReposForIssueSync(db: DbClient) {
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
            // index ensures nulls first
            lt(repos.lastSyncedAt, sql`NOW() - INTERVAL '10 minutes'`),
          ),
        ),
      )
      .returning({
        repoId: repos.id,
      });
  }
  // return issueIds to be used for embeddings update
  export async function upsertIssuesCommentsLabels(
    {
      issuesToInsert,
      commentsToInsert,
      labelsToInsert,
      issueToLabelRelationsToInsertNodeIds,
    }: Awaited<
      ReturnType<typeof Github.getIssuesViaIterator>
    >["issuesAndCommentsLabels"],
    db: DbClient,
  ) {
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
  }

  export async function getInitInProgressCount(db: DbClient) {
    const [countRes] = await db
      .select({
        count: count(),
      })
      .from(repos)
      .where(eq(repos.initStatus, "in_progress"));

    return countRes?.count ?? 0;
  }

  export async function getInitReadyRepo(db: DbClient) {
    const [result] = await db
      .select({
        repoId: repos.id,
      })
      .from(repos)
      .where(eq(repos.initStatus, "ready"))
      // always initialize earliest created repo first
      .orderBy(asc(repos.createdAt))
      .limit(1);

    return result?.repoId ?? null;
  }

  export async function markInitInProgress(db: DbClient, repoId: string) {
    await db
      .update(repos)
      .set({ initStatus: "in_progress" })
      .where(eq(repos.id, repoId));
  }
}

export const repoIssuesLastUpdatedSql = (repoTable: typeof repos) => sql<
  string | null
>`(
  SELECT ${issueTable.issueUpdatedAt}
  FROM ${issueTable}
  WHERE ${issueTable.repoId} = ${repoTable}.id AND ${issueTable.embedding} IS NOT NULL
  ORDER BY ${issueTable.issueUpdatedAt} DESC
  LIMIT 1
)`;
