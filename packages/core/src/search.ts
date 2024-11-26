import type { RateLimiter } from "./constants/rate-limit";
import { and, cosineDistance, eq, getDb, gt, ilike, or, sql } from "./db";
import { convertToIssueStateSql, issues } from "./db/schema/entities/issue.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { jsonArrayContains, jsonExtract, lower } from "./db/utils";
import { Embedding } from "./embedding";
import { parseSearchQuery } from "./search.util";

export namespace Search {
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

  export async function getIssues({
    query,
    rateLimiter,
    lucky = false,
  }: {
    query: string;
    rateLimiter?: RateLimiter;
    lucky?: boolean;
  }) {
    const SIMILARITY_THRESHOLD = 0.15; // arbitrary threshold, to be tuned
    const { db } = getDb();

    const {
      substringQueries,
      titleQueries,
      authorQueries,
      bodyQueries,
      stateQueries,
      repoQueries,
      labelQueries,
    } = parseSearchQuery(query);

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
            // cannot use ILIKE because name is stored in JSONB
            eq(
              lower(jsonExtract(issues.author, "name")),
              subQuery.toLowerCase(),
            ),
          ),
          ...repoQueries.map((subQuery) => ilike(repos.name, `${subQuery}`)),
          ...stateQueries.map((state) => convertToIssueStateSql(state)),
          ...labelQueries.map((subQuery) =>
            jsonArrayContains(issues.labels, "name", subQuery.toLowerCase()),
          ),
        ),
      )
      .limit(lucky ? 1 : 50);
  }
}
