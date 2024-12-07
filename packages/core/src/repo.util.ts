import { sql } from "drizzle-orm";

import { issueTable } from "./db/schema/entities/issue.sql";
import type { repos } from "./db/schema/entities/repo.sql";

export const repoIssuesLastUpdatedSql = (
  repoTable: typeof repos,
) => sql<Date | null>`(
  SELECT ${issueTable.issueUpdatedAt}
  FROM ${issueTable}
  WHERE ${issueTable.repoId} = ${repoTable}.id AND ${issueTable.embedding} IS NOT NULL
  ORDER BY ${issueTable.issueUpdatedAt} DESC
  LIMIT 1
)`;
