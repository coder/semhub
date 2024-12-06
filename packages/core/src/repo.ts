import type { DbClient } from "@/db";
import { and, desc, eq, isNotNull, sql } from "@/db";
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
    if (!result) {
      throw new Error("Failed to create repo");
    }
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
  // return issueIds to be used for embeddings update
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
    if (sanitizedIssuesToInsert.length === 0) {
      throw new Error("No issues to upsert");
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
          set: conflictUpdateAllExcept(issueTable, [
            "nodeId",
            "id",
            "createdAt",
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
      return insertedIssueIds.map(({ id }) => id);
    });
  }
  export async function getRepoIssueLastUpdatedAt(
    repoId: string,
    db: DbClient,
  ) {
    // see repoIssuesLastUpdatedSql; the two should be the same
    const [result] = await db
      .select({
        issuesLastUpdatedAt: issueTable.issueUpdatedAt,
      })
      .from(issueTable)
      .where(
        // must include embedding to be considered "updated"
        // but OK if embedding is out-of-date -> this should be handled by embedding sync
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
  // export async function hasIssues(repoId: string, db: DbClient) {
  //   const [result] = await db
  //     .select({
  //       count: count(),
  //     })
  //     .from(issueTable)
  //     .where(eq(issueTable.repoId, repoId));
  //   if (!result) return false;
  //   return result.count > 0;
  // }
  // export async function allIssuesHaveEmbeddings(repoId: string, db: DbClient) {
  //   const [result] = await db
  //     .select({
  //       count: count(),
  //     })
  //     .from(issueTable)
  //     .where(and(eq(issueTable.repoId, repoId), isNull(issueTable.embedding)));
  //   if (!result) {
  //     return false;
  //   }
  //   return result.count === 0;
  // }
}
