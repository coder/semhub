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

  interface ParsedQuery {
    substringQueries: string[];
    titleQueries: string[];
    bodyQueries: string[];
  }

  export function parseSearchQuery(inputQuery: string): ParsedQuery {
    // First extract and remove operator quotes to prevent interference
    const titleMatches = inputQuery.match(/title:"([^"]*)"/g);
    const bodyMatches = inputQuery.match(/body:"([^"]*)"/g);

    // Remove the operator matches from the query before looking for general quotes
    const remainingQuery = [
      ...(titleMatches ?? []),
      ...(bodyMatches ?? []),
    ].reduce((query, match) => query.replace(match, ""), inputQuery);

    // Now look for remaining quoted strings in the cleaned query
    const quotedMatches = remainingQuery.match(/"([^"]*)"/g);
    const substringQueries = quotedMatches?.map((q) => q.slice(1, -1)) ?? [];

    const titleQueries =
      titleMatches?.map((m) => m.replace(/^title:"(.*)"$/, "$1")) ?? [];
    const bodyQueries =
      bodyMatches?.map((m) => m.replace(/^body:"(.*)"$/, "$1")) ?? [];

    return {
      substringQueries,
      titleQueries,
      bodyQueries,
    };
  }

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

    const { substringQueries, titleQueries, bodyQueries } =
      parseSearchQuery(query);

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
          // general substring queries match either title or body
          ...substringQueries.map((subQuery) =>
            or(
              ilike(issues.title, `%${subQuery}%`),
              ilike(issues.body, `%${subQuery}%`),
            ),
          ),
          // title-specific queries
          ...titleQueries.map((subQuery) =>
            ilike(issues.title, `%${subQuery}%`),
          ),
          // body-specific queries
          ...bodyQueries.map((subQuery) => ilike(issues.body, `%${subQuery}%`)),
        ),
      )
      .limit(lucky ? 1 : 50);
  }
}
