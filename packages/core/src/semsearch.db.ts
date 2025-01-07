import type { PgSelect } from "drizzle-orm/pg-core";

import { and, eq, ilike, or, sql } from "./db";
import { comments } from "./db/schema/entities/comment.sql";
import { issuesToLabels } from "./db/schema/entities/issue-to-label.sql";
import type { IssueTable } from "./db/schema/entities/issue.sql";
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

export function getOperatorsWhere(
  parsedSearchQuery: ReturnType<typeof parseSearchQuery>,
) {
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

  return [
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
    hasAllLabels(issueTable.id, labelQueries),
  ];
}

export function getBaseSelect(issueTable: IssueTable) {
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

export function applyAccessControl<T extends PgSelect>(
  query: T,
  params: SearchParams,
) {
  const { mode } = params;
  switch (mode) {
    case "public":
      return query.where(eq(repos.isPrivate, false));
    case "me":
      const userId = params.userId;
      return query.innerJoin(
        usersToRepos,
        and(
          eq(usersToRepos.repoId, repos.id),
          eq(usersToRepos.userId, userId),
          eq(usersToRepos.status, "active"),
        ),
      );
    default:
      mode satisfies never;
      throw new Error("Invalid mode");
  }
}

export function applyPaginationAndLimit<T extends PgSelect>(
  query: T,
  params: SearchParams,
  offset: number,
) {
  return params.mode === "public" && params.lucky
    ? query.limit(1)
    : query.limit(params.pageSize).offset(offset);
}

export function applyCollectionFilter<T extends PgSelect>(
  query: T,
  collectionQueries: string[],
  params: SearchParams,
) {
  if (collectionQueries.length === 0) {
    return query;
  }

  switch (params.mode) {
    case "public":
      return query
        .innerJoin(
          publicCollectionsToRepos,
          eq(publicCollectionsToRepos.repoId, repos.id),
        )
        .innerJoin(
          publicCollections,
          and(
            eq(publicCollections.id, publicCollectionsToRepos.collectionId),
            // Match any of the collection names from the query
            or(
              ...collectionQueries.map((name) =>
                eq(publicCollections.name, name),
              ),
            ),
          ),
        );
    default:
      return query;
  }
}
