import type { RateLimiter } from "./constants/rate-limit";
import { cosineDistance, eq, getDb, gt, ilike, sql } from "./db";
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
  export async function getTitleSubstringMatch({
    query,
    lucky = false,
  }: {
    query: string;
    lucky?: boolean;
  }) {
    const { db } = getDb();
    return await db
      .select(defaultIssuesSelect)
      .from(issues)
      .leftJoin(repos, eq(issues.repoId, repos.id))
      .where(ilike(issues.title, `%${query}%`))
      .limit(lucky ? 1 : 50);
  }

  export async function getSemanticallySimilar({
    query,
    rateLimiter,
    lucky = false,
  }: {
    query: string;
    rateLimiter?: RateLimiter;
    lucky?: boolean;
  }) {
    const SIMILARITY_THRESHOLD = 0.2;
    const embedding = await Embedding.createEmbedding({
      input: query,
      rateLimiter,
    });
    const similarity = sql<number>`1-(${cosineDistance(issues.embedding, embedding)})`;

    const { db } = getDb();
    return await db
      .select({
        ...defaultIssuesSelect,
        similarity,
      })
      .from(issues)
      .leftJoin(repos, eq(issues.repoId, repos.id))
      .where(gt(similarity, SIMILARITY_THRESHOLD))
      .limit(lucky ? 1 : 50);
  }
}
