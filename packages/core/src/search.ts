import type { RateLimiter } from "./constants/rate-limit";
import { and, cosineDistance, eq, getDb, gt, ilike, or, sql } from "./db";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import { convertToIssueStateSql, issues } from "./db/schema/entities/issue.sql";
import { labels } from "./db/schema/entities/label.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { jsonContains, lower } from "./db/utils";
import { Embedding } from "./embedding";
import { parseSearchQuery } from "./search.util";

export namespace Search {
  interface LabelSelect {
    name: string;
    color: string;
    description: string | null;
  }
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

    const labelQueryArray = sql.join(
      labelQueries.map((q) => sql`${q.toLowerCase()}`),
      sql`, `,
    );
    const selected = await db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
        body: issues.body,
        // TODO: use typesafe function instead
        labels: sql<LabelSelect[]>`
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'name', l.name,
                'color', l.color,
                'description', l.description
              ))
              FROM issues_to_labels itl
              JOIN labels l ON l.id = itl.label_id
              WHERE itl.issue_id = ${issues.id}
            ),
            '[]'::json
          )`,
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
        similarity,
      })
      .from(issues)
      .leftJoin(repos, eq(issues.repoId, repos.id))
      .leftJoin(
        issuesToLabels,
        labelQueries.length > 0
          ? eq(issues.id, issuesToLabels.issueId)
          : undefined,
      )
      .leftJoin(
        labels,
        labelQueries.length > 0
          ? eq(issuesToLabels.labelId, labels.id)
          : undefined,
      )
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
          ...titleQueries.map((subQuery) =>
            ilike(issues.title, `%${subQuery}%`),
          ),
          ...bodyQueries.map((subQuery) => ilike(issues.body, `%${subQuery}%`)),
          ...authorQueries.map((subQuery) =>
            // cannot use ILIKE because name is stored in JSONB
            eq(
              lower(jsonContains(issues.author, "name")),
              subQuery.toLowerCase(),
            ),
          ),
          ...repoQueries.map((subQuery) => ilike(repos.name, `${subQuery}`)),
          ...stateQueries.map((state) => convertToIssueStateSql(state)),
          ...(labelQueries.length > 0
            ? [
                sql`(
                  SELECT COUNT(DISTINCT l.name)
                  FROM issues_to_labels itl
                  JOIN labels l ON l.id = itl.label_id
                  WHERE itl.issue_id = ${issues.id}
                  AND LOWER(l.name) = ANY(ARRAY[${labelQueryArray}])
                ) = ${labelQueries.length}`,
              ]
            : []),
        ),
      )
      .limit(lucky ? 1 : 50);
    return selected;
  }
}
