import { isNotNull, sql } from "drizzle-orm";
import { ulid } from "ulidx";

import { getDb } from "@/core/db";
import { issuesToLabels } from "@/core/db/schema/entities/issue-to-label.sql";
import { issues } from "@/core/db/schema/entities/issue.sql";
import { labels } from "@/core/db/schema/entities/label.sql";
import type { Label } from "@/core/db/schema/shared";
import { conflictUpdateAllExcept } from "@/core/db/utils/conflict";

async function main() {
  console.log("Starting label normalization...");

  const { db, closeConnection } = getDb();
  // Get all issues with labels
  const issuesWithLabels = await db
    .select({
      id: issues.id,
      labels: issues.labels,
    })
    .from(issues)
    .where(isNotNull(issues.labels))
    .orderBy(issues.issueUpdatedAt); // ascending by default

  console.log(`Found ${issuesWithLabels.length} issues with labels`);

  interface NewLabel extends Label {
    id: string;
  }
  // map unique labels: nodeId to Label
  const nodeIdToLabel = new Map<string, NewLabel>();

  // First pass: collect all unique labels
  for (const issue of issuesWithLabels) {
    const issueLabels = issue.labels;
    if (!issueLabels)
      throw new Error(`Issue has no labels despite SQL: ${issue.id}`);

    for (const label of issueLabels) {
      // we always override, because we sorted by updatedAt ASC
      // so the latest version of the label is always used
      nodeIdToLabel.set(label.nodeId, {
        id: `lbl_${ulid()}`,
        nodeId: label.nodeId,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    }
  }

  console.log(`Found ${nodeIdToLabel.size} unique labels`);
  if (nodeIdToLabel.size === 0) {
    console.log("No labels to normalize, exiting");
    await closeConnection();
    return;
  }

  // Wrap all database operations in a transaction
  await db.transaction(async (tx) => {
    // Insert all unique labels
    console.log("Inserting labels...");
    const insertedLabels = await tx
      .insert(labels)
      .values([...nodeIdToLabel.values()])
      .onConflictDoUpdate({
        target: [labels.nodeId],
        set: conflictUpdateAllExcept(labels, ["id", "createdAt", "nodeId"]),
      })
      .returning({
        id: labels.id,
        nodeId: labels.nodeId,
        // This will be null for updates, and the new value for inserts
        wasInserted: sql<boolean>`
          CASE
            WHEN xmax = 0 THEN true  -- This is a new insert
            ELSE false               -- This was an update
          END
        `.as("wasInserted"),
      });

    console.log(
      `Inserted ${insertedLabels.filter((l) => l.wasInserted).length} new labels`,
    );
    console.log(
      `Updated ${insertedLabels.filter((l) => !l.wasInserted).length} existing labels`,
    );

    // Create a Set of inserted label IDs for quick lookup
    const insertedLabelIds = new Set(
      insertedLabels.filter((l) => l.wasInserted).map((l) => l.id),
    );

    // Create issue-label relationships
    const relationships = [];
    for (const issue of issuesWithLabels) {
      const issueLabels = issue.labels;
      if (!issueLabels) continue;

      for (const label of issueLabels) {
        const labelRecord = nodeIdToLabel.get(label.nodeId);
        if (!labelRecord) throw new Error(`Label not found: ${label.nodeId}`);

        // Only add relationship if the label was newly inserted
        if (insertedLabelIds.has(labelRecord.id)) {
          relationships.push({
            issueId: issue.id,
            labelId: labelRecord.id,
          });
        }
      }
    }
    if (relationships.length > 0) {
      console.log(
        `Creating ${relationships.length} issue-label relationships...`,
      );
      await tx
        .insert(issuesToLabels)
        .values(relationships)
        .onConflictDoUpdate({
          target: [issuesToLabels.issueId, issuesToLabels.labelId],
          set: conflictUpdateAllExcept(issuesToLabels, [
            "createdAt",
            "issueId",
            "labelId",
          ]),
        });
    }
  });

  await closeConnection();
  console.log("Migration completed successfully!");
}

main();
