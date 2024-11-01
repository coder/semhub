import { Console, Effect } from "effect";

import { getDrizzle, isNull, lt, or } from "./db";
import { issues } from "./db/schema/entities/issue.sql";

export module Embedding {
  export async function sync() {
    const db = getDrizzle();
    // get issues where (1) embedding is null (2) embedding was created BEFORE issueUpdatedAt
    const issuesWithOutdatedEmbedding = await db
      .select({
        issueId: issues.id,
        author: issues.author,
        title: issues.title,
        body: issues.body,
        issueState: issues.issueState,
        issueStateReason: issues.issueStateReason,
        labels: issues.labels,
      })
      .from(issues)
      .where(
        or(
          isNull(issues.embedding), // (1)
          lt(issues.embeddingCreatedAt, issues.issueUpdatedAt), // (2)
        ),
      );
    // TODO: rate limit to ensure calls to OpenAI are not exceeded
    // in this case, single worker call
    const program = Console.log("Hello, World!");

    Effect.runSync(program);

    return [];
  }
}
