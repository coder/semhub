import dedent from "dedent";

import { getDrizzle, isNull, lt, or } from "./db";
import type { IssueFieldsForEmbedding } from "./db/schema/entities/issue.schema";
import { issues } from "./db/schema/entities/issue.sql";
import { getOpenAIClient } from "./openai";

export module Embedding {
  export async function sync() {
    const client = getOpenAIClient();
    const db = getDrizzle();
    // get issues where (1) embedding is null (2) embedding was created BEFORE issueUpdatedAt
    const issuesWithOutdatedEmbedding: Array<IssueFieldsForEmbedding> = await db
      .select({
        number: issues.number,
        author: issues.author,
        title: issues.title,
        body: issues.body,
        issueState: issues.issueState,
        issueStateReason: issues.issueStateReason,
        labels: issues.labels,
        issueCreatedAt: issues.issueCreatedAt,
        issueClosedAt: issues.issueClosedAt,
      })
      .from(issues)
      .where(
        or(
          isNull(issues.embedding), // (1)
          lt(issues.embeddingCreatedAt, issues.issueUpdatedAt), // (2)
        ),
      );
    // for (const issue of issuesWithOutdatedEmbedding) {
    //   const res = await client.embeddings.create({
    //     model: "text-embedding-3-large", // their best performing model with 3072 vector dimensions
    //     input: formatIssueForEmbedding(issue),
    //   });
    // }
    // in this case, single worker call
    // const program = Console.log("Hello, World!");
    // Effect.runSync(program);

    return [];
  }
  function formatIssueForEmbedding({
    number,
    author,
    title,
    body,
    issueState,
    issueStateReason,
    labels,
    issueCreatedAt,
    issueClosedAt,
  }: IssueFieldsForEmbedding): string {
    return (
      dedent`
    Issue #${number}: ${title}
    Body: ${body}
    ${labels ? `Labels: ${labels.map((label) => `${label.name}${label.description ? ` (${label.description})` : ""}`).join(", ")}` : ""}
    ` +
      // the following are "metadata" fields, but including them because conceivably
      // users may include them in their search
      dedent`
    State: ${issueState}
    State Reason: ${issueStateReason}
    ${author ? `Author: ${author.name}` : ""}
    Created At: ${issueCreatedAt}
    ${issueClosedAt ? `Closed At: ${issueClosedAt}` : ""}
    `
    );
  }
}
