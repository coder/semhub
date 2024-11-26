import { PgDialect } from "drizzle-orm/pg-core";

import type { RateLimiter } from "./constants/rate-limit";
import type { AnyColumn, SQL } from "./db";
import { and, cosineDistance, eq, getDb, gt, ilike, or, sql } from "./db";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import { convertToIssueStateSql, issues } from "./db/schema/entities/issue.sql";
import { labels } from "./db/schema/entities/label.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { jsonAggBuildObjectFromJoin } from "./db/utils/external-utils";
import { lower } from "./db/utils/general";
import { jsonContains } from "./db/utils/json";
import { Embedding } from "./embedding";
import { parseSearchQuery } from "./search.util";

// const pgDialect = new PgDialect();
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

    const selected = db
      .select({
        // id: issues.id,
        number: issues.number,
        title: issues.title,
        // body: issues.body,
        labels: jsonAggBuildObjectFromJoin(
          {
            name: labels.name,
            color: labels.color,
            description: labels.description,
          },
          {
            from: sql`${issuesToLabels}`,
            joinTable: sql`${labels}`,
            joinCondition: eq(labels.id, issuesToLabels.labelId),
            whereCondition: eq(issuesToLabels.issueId, issues.id),
          },
        ),
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
        // similarity,
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
            ? [hasAllLabels(issues.id, labelQueries)]
            : []),
        ),
      )
      .limit(lucky ? 1 : 50);
    // console.log("query", pgDialect.sqlToQuery(selected.getSQL()));
    const result = await selected;
    // console.log("result", result.length);
    console.log({ result });
    return result;
  }
}

/**
 * Creates a condition to check if all specified labels are present for an issue
 * @param issueId The ID of the issue to check
 * @param labelQueries Array of label names to check for (case-insensitive)
 */
export function hasAllLabels(
  issueId: SQL | AnyColumn,
  labelQueries: string[],
): SQL<boolean> {
  if (labelQueries.length === 0) {
    return sql`true`;
  }

  const valuesArray = sql.join(
    labelQueries.map((v) => sql`${v.toLowerCase()}`),
    sql`, `,
  );

  return sql`(
    SELECT ARRAY_AGG(DISTINCT LOWER(l.name) ORDER BY LOWER(l.name)) =
           ARRAY(SELECT unnest(ARRAY[${valuesArray}]) ORDER BY 1)
    FROM "issues_to_labels" itl
    JOIN "labels" l ON l.id = itl.label_id
    WHERE itl.issue_id = ${issueId}
    AND LOWER(l.name) = ANY(ARRAY[${valuesArray}])
  )`;
}
