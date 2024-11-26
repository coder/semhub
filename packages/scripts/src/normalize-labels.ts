import { isNotNull } from "drizzle-orm";
import { ulid } from "ulidx";

import { getDb } from "@/core/db";
import { conflictUpdateAllExcept } from "@/core/db/helper";
import { issuesToLabels } from "@/core/db/schema/entities/issue-to-label.sql";
import { issues } from "@/core/db/schema/entities/issue.sql";
import { labels } from "@/core/db/schema/entities/label.sql";
import type { Label } from "@/core/db/schema/shared";

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
    .where(isNotNull(issues.labels));

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
      if (!nodeIdToLabel.has(label.nodeId)) {
        nodeIdToLabel.set(label.nodeId, {
          id: `lbl_${ulid()}`,
          nodeId: label.nodeId,
          name: label.name,
          color: label.color,
          description: label.description,
        });
      }
    }
  }

  console.log(`Found ${nodeIdToLabel.size} unique labels`);

  // Wrap all database operations in a transaction
  await db.transaction(async (tx) => {
    // Insert all unique labels
    console.log("Inserting labels...");
    await tx
      .insert(labels)
      .values([...nodeIdToLabel.values()])
      .onConflictDoUpdate({
        target: [labels.nodeId],
        set: conflictUpdateAllExcept(labels, ["id", "createdAt", "nodeId"]),
      });

    // Create issue-label relationships
    const relationships = [];
    for (const issue of issuesWithLabels) {
      const issueLabels = issue.labels;
      if (!issueLabels) continue;

      for (const label of issueLabels) {
        const labelRecord = nodeIdToLabel.get(label.nodeId);
        if (!labelRecord) throw new Error(`Label not found: ${label.nodeId}`);

        relationships.push({
          issueId: issue.id,
          labelId: labelRecord.id,
        });
      }
    }

    console.log(
      `Creating ${relationships.length} issue-label relationships...`,
    );
    await tx
      .insert(issuesToLabels)
      .values(relationships)
      .onConflictDoUpdate({
        target: [labels.nodeId],
        set: conflictUpdateAllExcept(issuesToLabels, [
          "createdAt",
          "issueId",
          "labelId",
        ]),
      });
  });

  await closeConnection();
  console.log("Migration completed successfully!");
}

main();
