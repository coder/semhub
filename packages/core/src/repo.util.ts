import { sql } from "drizzle-orm";

import { issueTable } from "./db/schema/entities/issue.sql";
import { repos } from "./db/schema/entities/repo.sql";

export const repoIssuesLastUpdatedSql = sql<Date | null>`(
  SELECT ${issueTable.issueUpdatedAt}
  FROM ${issueTable}
  WHERE ${issueTable.repoId} = ${repos.id} AND ${issueTable.embedding} IS NOT NULL
  ORDER BY ${issueTable.issueUpdatedAt} DESC
  LIMIT 1
)`;
