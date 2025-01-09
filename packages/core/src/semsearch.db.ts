import type { SQL } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

import { and, eq, ilike, or, sql } from "./db";
import { comments } from "./db/schema/entities/comment.sql";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import {
  convertToIssueStateSql,
  issueTable,
} from "./db/schema/entities/issue.sql";
import { hasAllLabels, labels } from "./db/schema/entities/label.sql";
import { publicCollectionsToRepos } from "./db/schema/entities/public-collection-to-repo.sql";
import { publicCollections } from "./db/schema/entities/public-collection.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { usersToRepos } from "./db/schema/entities/user-to-repo.sql";
import { lower } from "./db/utils/general";
import { jsonAggBuildObjectFromJoin, jsonContains } from "./db/utils/json";
import type { SearchParams } from "./semsearch.types";
import type { parseSearchQuery } from "./semsearch.util";

export function getBaseSelect() {
  return {
    id: issueTable.id,
    number: issueTable.number,
    title: issueTable.title,
    labels: jsonAggBuildObjectFromJoin(
      {
        name: labels.name,
        color: labels.color,
        description: labels.description,
      },
      {
        from: issuesToLabels,
        joinTable: labels,
        joinCondition: eq(labels.id, issuesToLabels.labelId),
        whereCondition: eq(issuesToLabels.issueId, issueTable.id),
      },
    ).as("labels"),
    issueUrl: sql<string>`${issueTable.htmlUrl}`.as("issueUrl"),
    author: issueTable.author,
    issueState: issueTable.issueState,
    issueStateReason: issueTable.issueStateReason,
    issueCreatedAt: issueTable.issueCreatedAt,
    issueClosedAt: issueTable.issueClosedAt,
    issueUpdatedAt: issueTable.issueUpdatedAt,
    repoName: repos.name,
    repoUrl: sql<string>`${repos.htmlUrl}`.as("repoUrl"),
    repoOwnerName: repos.ownerLogin,
    repoLastSyncedAt: repos.lastSyncedAt,
    commentCount:
      sql<number>`(SELECT count(*) FROM ${comments} WHERE ${comments.issueId} = ${issueTable.id})`.as(
        "comment_count",
      ),
  };
}

export function applyFilters<T extends PgSelect>(
  query: T,
  params: SearchParams,
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
) {
  let result = query as PgSelect;
  // undefined necessary because of `or` function's return type
  let whereClauses: Array<SQL<unknown> | undefined> = [];

  // ===== Access Control =====
  // Handle access control based on mode
  const { mode } = params;
  switch (mode) {
    case "public":
      whereClauses.push(eq(repos.isPrivate, false));
      break;
    case "me":
      result = result.innerJoin(
        usersToRepos,
        and(
          eq(usersToRepos.repoId, repos.id),
          eq(usersToRepos.userId, params.userId),
          eq(usersToRepos.status, "active"),
        ),
      );
      break;
    default:
      mode satisfies never;
  }

  // ===== Collection Filter =====
  // Only apply if collection queries exist
  const { collectionQueries } = parsedSearchQuery;
  if (collectionQueries.length > 0) {
    switch (mode) {
      case "public":
        result = result
          .innerJoin(
            publicCollectionsToRepos,
            eq(publicCollectionsToRepos.repoId, repos.id),
          )
          .innerJoin(
            publicCollections,
            and(
              eq(publicCollections.id, publicCollectionsToRepos.collectionId),
              or(
                ...collectionQueries.map((name) =>
                  eq(publicCollections.name, name),
                ),
              ),
            ),
          );
        break;
      case "me":
        // TODO: Handle 'me' mode collections
        break;
      default:
        mode satisfies never;
    }
  }

  // ===== Search Operators =====
  // Apply all search operators (title, body, author, state, etc.)
  const {
    substringQueries,
    titleQueries,
    authorQueries,
    bodyQueries,
    stateQueries,
    repoQueries,
    labelQueries,
    ownerQueries,
  } = parsedSearchQuery;

  whereClauses.push(
    ...substringQueries.map((subQuery) =>
      or(
        ilike(issueTable.title, `%${subQuery}%`),
        ilike(issueTable.body, `%${subQuery}%`),
      ),
    ),
    ...titleQueries.map((subQuery) => ilike(issueTable.title, `%${subQuery}%`)),
    ...bodyQueries.map((subQuery) => ilike(issueTable.body, `%${subQuery}%`)),
    ...authorQueries.map((subQuery) =>
      eq(
        lower(jsonContains(issueTable.author, "name")),
        subQuery.toLowerCase(),
      ),
    ),
    ...repoQueries.map((subQuery) => ilike(repos.name, `${subQuery}`)),
    ...ownerQueries.map((subQuery) => ilike(repos.ownerLogin, `${subQuery}`)),
    ...stateQueries.map((state) => convertToIssueStateSql(state)),
  );

  if (labelQueries.length > 0) {
    whereClauses.push(hasAllLabels(issueTable.id, labelQueries));
  }

  // just for type safety
  const validConditions = whereClauses.filter(
    (c): c is SQL<unknown> => c !== undefined,
  );
  // need to apply all conditions in a single where clause to avoid overwriting previous conditions
  if (validConditions.length > 0) {
    result = result.where(and(...validConditions));
  }

  return result as T;
}

export function applyPagination<T extends PgSelect>(
  query: T,
  params: SearchParams,
  offset?: number,
) {
  return params.mode === "public" && params.lucky
    ? query.limit(1)
    : query.limit(params.pageSize).offset(offset ?? 0);
}
