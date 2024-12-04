import type { DbClient } from "@/db";
import { and, eq, isNotNull, sql } from "@/db";
import { comments } from "@/db/schema/entities/comment.sql";
import { issuesToLabels } from "@/db/schema/entities/issue-to-label.sql";
import { issueTable } from "@/db/schema/entities/issue.sql";
import { labels as labelTable } from "@/db/schema/entities/label.sql";
import { repos } from "@/db/schema/entities/repo.sql";
import { conflictUpdateAllExcept } from "@/db/utils/conflict";
import type { Github } from "@/github";

export namespace Repo {
  export async function getReposForCron(db: DbClient) {
    return await db
      .select({
        repoId: repos.id,
        repoName: repos.name,
        repoOwner: repos.owner,
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
      })
      .from(repos)
      .where(
        // basically, get all repos that have been initialized
        // and repos that are not currently syncing
        and(isNotNull(repos.issuesLastUpdatedAt), eq(repos.isSyncing, false)),
      );
  }
  export async function updateSyncStatus(
    args:
      | { repoId: string; isSyncing: true }
      | {
          repoId: string;
          isSyncing: false;
          successfulSynced: true;
          syncedAt: Date;
        }
      | { repoId: string; isSyncing: false; successfulSynced: false },
    db: DbClient,
  ) {
    if (args.isSyncing) {
      await db
        .update(repos)
        .set({ isSyncing: true })
        .where(eq(repos.id, args.repoId));
    } else {
      await db
        .update(repos)
        .set({
          isSyncing: false,
          lastSyncedAt: args.successfulSynced ? args.syncedAt : undefined,
        })
        .where(eq(repos.id, args.repoId));
    }
  }

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
        issuesLastUpdatedAt: repos.issuesLastUpdatedAt,
        repoName: repos.name,
        repoOwner: repos.owner,
        isSyncing: repos.isSyncing,
      });
    return result;
  }
  export async function upsertIssuesCommentsLabels(
    {
      issuesToInsert,
      commentsToInsert,
      labelsToInsert,
      issueToLabelRelationsToInsertNodeIds,
    }: Awaited<
      ReturnType<typeof Github.getIssuesSinceLastUpdated>
    >["issuesAndCommentsLabels"],
    db: DbClient,
  ) {
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
    });
  }
}
