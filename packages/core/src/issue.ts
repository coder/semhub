import type { RateLimiter } from "./constants/rate-limit";
import { SEARCH_OPERATORS } from "./constants/search";
import { and, cosineDistance, eq, getDb, gt, ilike, or, sql } from "./db";
import {
  issues,
  issueStateEnum,
  type IssueState,
} from "./db/schema/entities/issue.sql";
import { repos } from "./db/schema/entities/repo.sql";
import { jsonExtract, lower } from "./db/utils";
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
    // Create a Map with empty arrays as default values for each operator
    const operatorMatches = new Map(
      SEARCH_OPERATORS.map(({ operator }) => [operator, [] as string[]]),
    );
    let remainingQuery = inputQuery;

    // Process each operator according to its configuration
    SEARCH_OPERATORS.forEach((opConfig) => {
      const { operator, enclosedInQuotes } = opConfig;
      const pattern = enclosedInQuotes
        ? `${operator}:"([^"]*)"` // With quotes: title:"example"
        : `${operator}:(?:"([^"]*)"|([^\\s]*))`; // Match either quoted value or non-space value

      const matches = inputQuery.match(new RegExp(pattern, "g"));
      if (matches) {
        // Extract the actual values based on the pattern
        operatorMatches.set(
          operator,
          matches.map((m) =>
            m.replace(
              new RegExp(
                `^${operator}:${enclosedInQuotes ? '"(.*)"' : "(.*)"}$`,
              ),
              "$1",
            ),
          ),
        );
        // Remove matches from remaining query
        remainingQuery = matches.reduce(
          (query, match) => query.replace(match, ""),
          remainingQuery,
        );
      }
      if (operator === "state") {
        console.log({ matches });
        console.log({ remainingQuery });
      }
    });

    // Look for remaining quoted strings in the cleaned query
    const quotedMatches = remainingQuery.match(/"([^"]*)"/g);
    const substringQueries = quotedMatches?.map((q) => q.slice(1, -1)) ?? [];

    // extra handling for enums conversion
    const stateQueries = [
      ...new Set( // using set to remove duplicates
        operatorMatches
          .get("state")
          ?.map((q): IssueState | null => {
            const normalized = q.toUpperCase();
            return issueStateEnum.enumValues.includes(normalized as IssueState)
              ? (normalized as IssueState)
              : null;
          })
          .filter((state): state is IssueState => state !== null) ?? [],
      ),
    ];

    return {
      substringQueries,
      titleQueries: operatorMatches.get("title") ?? [],
      authorQueries: operatorMatches.get("author") ?? [],
      bodyQueries: operatorMatches.get("body") ?? [],
      repoQueries: operatorMatches.get("repo") ?? [],
      stateQueries,
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

    const {
      substringQueries,
      titleQueries,
      authorQueries,
      bodyQueries,
      stateQueries,
      repoQueries,
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
          ...stateQueries.map((state) => eq(issues.issueState, state)),
        ),
      )
      .limit(lucky ? 1 : 50);
  }
}
