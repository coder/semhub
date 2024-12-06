import type { DbClient } from "@/db";
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "@/db";
import { comments } from "@/db/schema/entities/comment.sql";
import { issuesToLabels } from "@/db/schema/entities/issue-to-label.sql";
import { issueTable } from "@/db/schema/entities/issue.sql";
import { labels as labelTable } from "@/db/schema/entities/label.sql";
import { repos } from "@/db/schema/entities/repo.sql";
import { conflictUpdateAllExcept } from "@/db/utils/conflict";
import { sanitizeForPg } from "@/db/utils/string";
import type { Github } from "@/github";

import { repoIssuesLastUpdatedSql } from "./repo.util";

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
        set: conflictUpdateAllExcept(repos, ["nodeId", "id", "createdAt"]),
      })
      .returning({
        repoId: repos.id,
        initStatus: repos.initStatus,
        repoName: repos.name,
        repoOwner: repos.owner,
      });
    return result;
  }
  export async function getReposForIssueSync(db: DbClient) {
    return await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        repoOwner: repos.owner,
        // TODO: verify this is working
        repoIssuesLastUpdatedAt: repoIssuesLastUpdatedSql,
      })
      .from(repos)
      .where(
        and(eq(repos.initStatus, "completed"), eq(repos.syncStatus, "ready")),
      );
  }
  export async function upsertIssuesCommentsLabels(
    {
      issuesToInsert,
      commentsToInsert,
      labelsToInsert,
      issueToLabelRelationsToInsertNodeIds,
    }: Awaited<
      ReturnType<typeof Github.getIssuesCommentsLabels>
    >["issuesAndCommentsLabels"],
    db: DbClient,
  ) {
    const sanitizedIssuesToInsert = issuesToInsert.map((issue) => ({
      ...issue,
      title: sanitizeForPg(issue.title),
      body: sanitizeForPg(issue.body),
    }));
    const sanitizedCommentsToInsert = commentsToInsert.map((comment) => ({
      ...comment,
      body: sanitizeForPg(comment.body),
    }));
    const sanitizedLabelsToInsert = labelsToInsert.map((label) => ({
      ...label,
      description: label.description ? sanitizeForPg(label.description) : null,
    }));

    await db.transaction(async (tx) => {
      await tx
        .insert(issueTable)
        .values(sanitizedIssuesToInsert)
        .onConflictDoUpdate({
          target: [issueTable.nodeId],
          set: conflictUpdateAllExcept(issueTable, [
            "nodeId",
            "id",
            "createdAt",
          ]),
        });
      if (labelsToInsert.length > 0) {
        console.log("inserting labels");
        await tx
          .insert(labelTable)
          .values(sanitizedLabelsToInsert)
          .onConflictDoUpdate({
            target: [labelTable.nodeId],
            set: conflictUpdateAllExcept(labelTable, [
              "nodeId",
              "id",
              "createdAt",
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
        console.log("inserting comments");
        await tx
          .with(issueIds)
          .insert(comments)
          .values(sanitizedCommentsToInsertWithIssueId)
          .onConflictDoUpdate({
            target: [comments.nodeId],
            set: conflictUpdateAllExcept(comments, [
              "nodeId",
              "id",
              "createdAt",
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
        console.log("inserting issue to label relations");
        await tx
          .with(labelIds, issueIds)
          .insert(issuesToLabels)
          .values(issueToLabelRelationsToInsert)
          .onConflictDoUpdate({
            target: [issuesToLabels.issueId, issuesToLabels.labelId],
            set: conflictUpdateAllExcept(issuesToLabels, [
              "issueId",
              "labelId",
              "createdAt",
            ]),
          });
      }
    });
  }
  export async function repoIssueLastUpdatedAt(repoId: string, db: DbClient) {
    // see repoIssuesLastUpdatedSql; the two should be the same
    const [result] = await db
      .select({
        issuesLastUpdatedAt: issueTable.issueUpdatedAt,
      })
      .from(issueTable)
      .where(
        // must include embedding to be considered "updated"
        and(eq(issueTable.repoId, repoId), isNotNull(issueTable.embedding)),
      )
      .orderBy(desc(issueTable.issueUpdatedAt))
      .limit(1);
    if (!result) {
      return null;
    }
    const { issuesLastUpdatedAt } = result;
    return issuesLastUpdatedAt;
  }
  export async function hasIssues(repoId: string, db: DbClient) {
    const [result] = await db
      .select({
        count: count(),
      })
      .from(issueTable)
      .where(eq(issueTable.repoId, repoId));
    if (!result) return false;
    return result.count > 0;
  }
  export async function allIssuesHaveEmbeddings(repoId: string, db: DbClient) {
    const [result] = await db
      .select({
        count: count(),
      })
      .from(issueTable)
      .where(and(eq(issueTable.repoId, repoId), isNull(issueTable.embedding)));
    if (!result) {
      return false;
    }
    return result.count === 0;
  }

  export async function initNextRepo(db: DbClient) {
    // only init one repo at a time, so if there are other repos with initStatus in progress, return null
    await db.transaction(
      async (tx) => {
        const [countRes] = await tx
          .select({
            count: count(),
          })
          .from(repos);

        if (countRes && countRes.count > 0) {
          return null;
        }
        const [result] = await tx
          .select({
            repoId: repos.id,
          })
          .from(repos)
          .where(eq(repos.initStatus, "queued"))
          .orderBy(asc(repos.createdAt))
          .limit(1);
        if (!result) return null;
        const { repoId } = result;
        await tx
          .update(repos)
          .set({ initStatus: "in_progress" })
          .where(eq(repos.id, repoId));
        return repoId;
      },
      {
        isolationLevel: "serializable",
      },
    );
  }
}
