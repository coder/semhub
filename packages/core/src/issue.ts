import type { RateLimiter } from "./constants/rate-limit";
import { and, cosineDistance, eq, getDb, gt, ilike, or, sql } from "./db";
import { issues } from "./db/schema/entities/issue.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { Embedding } from "./embedding";

export namespace Issue {
  const defaultIssuesSelect = {
    id: issues.id,
    number: issues.number,
    title: issues.title,
    body: issues.body,
    labels: issues.labels,
    issueUrl: issues.htmlUrl,
    author: issues.author,
    issueState: issues.issueState,
    issueStateReason: issues.issueStateReason,
    issueCreatedAt: issues.issueCreatedAt,
    issueClosedAt: issues.issueClosedAt,
    issueUpdatedAt: issues.issueUpdatedAt,
    repoName: repos.name,
    repoUrl: repos.htmlUrl,
    repoOwnerName: repos.owner,
  };
  export async function searchIssues({
    query,
    rateLimiter,
    lucky = false,
  }: {
    query: string;
    rateLimiter?: RateLimiter;
    lucky?: boolean;
  }) {
    const SIMILARITY_THRESHOLD = 0.15;
    const { db } = getDb();

    // Extract quoted substrings from query for substring matching
    const quotedMatches = query.match(/"([^"]*)"/g);
    const substringQueries = quotedMatches?.map((q) => q.slice(1, -1)) ?? []; // slice to remove quotes

    // Use the entire query for semantic search
    const embedding = await Embedding.createEmbedding({
      input: query,
      rateLimiter,
    });
    const similarity = sql<number>`1-(${cosineDistance(issues.embedding, embedding)})`;

    return await db
      .select({
        ...defaultIssuesSelect,
        similarity,
      })
      .from(issues)
      .leftJoin(repos, eq(issues.repoId, repos.id))
      .where(
        and(
          gt(similarity, SIMILARITY_THRESHOLD),
          ...substringQueries.map((subQuery) =>
            or(
              ilike(issues.title, `%${subQuery}%`),
              ilike(issues.body, `%${subQuery}%`),
            ),
          ),
        ),
      )
      .limit(lucky ? 1 : 50);
  }
}
