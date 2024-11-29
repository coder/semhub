import { and, eq, getDb, isNotNull, sql } from "@/db";
import { comments } from "@/db/schema/entities/comment.sql";
import { issuesToLabels } from "@/db/schema/entities/issue-to-label.sql";
import { issues as issueTable } from "@/db/schema/entities/issue.sql";
import { labels as labelTable } from "@/db/schema/entities/label.sql";
import { repos } from "@/db/schema/entities/repo.sql";
import { conflictUpdateAllExcept } from "@/db/utils/conflict";
import type { Github } from "@/github";

export namespace Repo {
  export async function getReposForCron() {
    const { db } = getDb();
    return await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        repoOwner: repos.owner,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
      })
      .from(repos)
      // basically, get all repos that have been initialized
      .where(
        and(isNotNull(repos.issuesLastUpdatedAt), eq(repos.isSyncing, false)),
      );
  }
  export async function updateSyncStatus(
    args:
      | { repoId: string; isSyncing: true }
      | { repoId: string; isSyncing: false; syncedAt: Date },
  ) {
    const { db } = getDb();
    if (args.isSyncing) {
      await db
        .update(repos)
        .set({ isSyncing: true })
        .where(eq(repos.id, args.repoId));
    } else {
      await db
        .update(repos)
        .set({ isSyncing: false, lastSyncedAt: args.syncedAt })
        .where(eq(repos.id, args.repoId));
    }
  }

  export async function createRepo(
    data: Awaited<ReturnType<typeof Github.getRepo>>,
  ) {
    const { db } = getDb();
    const {
      owner: { login: owner },
      name,
      node_id: nodeId,
      html_url: htmlUrl,
      private: isPrivate,
    } = data;
    return await db
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
        id: repos.id,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
      });
  }
  export async function upsertIssues({
    issuesToInsert,
    commentsToInsert,
    labelsToInsert,
    issueToLabelRelationsToInsertNodeIds,
    lastIssueUpdatedAt,
    repoId,
  }: Awaited<ReturnType<typeof Github.getIssuesWithMetadata>> & {
    repoId: string;
  }) {
    const { db } = getDb();
    await db.transaction(async (tx) => {
      await tx
        .insert(issueTable)
        .values(issuesToInsert)
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
          .values(labelsToInsert)
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
      const commentsToInsertWithIssueId = commentsToInsert.map(
        ({ issueNodeId, ...comment }) => ({
          ...comment,
          issueId: sql<string>`((SELECT id FROM issue_ids WHERE node_id = ${issueNodeId}))`,
        }),
      );
      if (commentsToInsertWithIssueId.length > 0) {
        console.log("inserting comments");
        await tx
          .with(issueIds)
          .insert(comments)
          .values(commentsToInsertWithIssueId)
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
      await tx
        .update(repos)
        .set({
          // TODO: for INITIALIZATION, only update this when embeddings are synced. this prevents users from searching before embeddings are synced and getting no results
          // for CRON JOBS, update this when issues are synced. embeddings createdAt are tracked within issues table
          issuesLastUpdatedAt: lastIssueUpdatedAt,
        })
        .where(eq(repos.id, repoId));
    });
  }
}
