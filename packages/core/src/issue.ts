import type { RateLimiter } from "./constants/rate-limit";
import { SEARCH_OPERATORS } from "./constants/search";
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

  export function parseSearchQuery(inputQuery: string) {
    const titleOperator = SEARCH_OPERATORS[0];
    const titleMatches = inputQuery.match(
      new RegExp(`${titleOperator}:"([^"]*)"`, "g"),
    );
    const authorOperator = SEARCH_OPERATORS[1];
    const authorMatches = inputQuery.match(
      new RegExp(`${authorOperator}:"([^"]*)"`, "g"),
    );
    const bodyOperator = SEARCH_OPERATORS[2];
    const bodyMatches = inputQuery.match(
      new RegExp(`${bodyOperator}:"([^"]*)"`, "g"),
    );

    // Remove the operator matches from the query before looking for general quotes
    const remainingQuery = [
      ...(titleMatches ?? []),
      ...(authorMatches ?? []),
      ...(bodyMatches ?? []),
    ].reduce((query, match) => query.replace(match, ""), inputQuery);

    // Now look for remaining quoted strings in the cleaned query
    const quotedMatches = remainingQuery.match(/"([^"]*)"/g);
    const substringQueries = quotedMatches?.map((q) => q.slice(1, -1)) ?? [];

    const titleQueries =
      titleMatches?.map((m) =>
        m.replace(new RegExp(`^${titleOperator}:"(.*)"$`), "$1"),
      ) ?? [];
    const authorQueries =
      authorMatches?.map((m) =>
        m.replace(new RegExp(`^${authorOperator}:"(.*)"$`), "$1"),
      ) ?? [];
    const bodyQueries =
      bodyMatches?.map((m) =>
        m.replace(new RegExp(`^${bodyOperator}:"(.*)"$`), "$1"),
      ) ?? [];

    return {
      substringQueries,
      titleQueries,
      authorQueries,
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

    const { substringQueries, titleQueries, authorQueries, bodyQueries } =
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
          // author-specific queries
          ...authorQueries.map((subQuery) =>
            ilike(issues.author, `%${subQuery}%`),
          ),
        ),
      )
      .limit(lucky ? 1 : 50);
  }
}
