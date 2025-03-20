import fs from "fs/promises";
import { and, eq, isNull, lt, not } from "drizzle-orm";
import { print } from "graphql";
import pMap from "p-map";
import { z } from "zod";

import { issueTable } from "@/core/db/schema/entities/issue.sql";
import { repos } from "@/core/db/schema/entities/repo.sql";
import type { AggregateReactions } from "@/core/db/schema/shared";
import { graphql } from "@/core/github/graphql/graphql";
import type { GraphqlOctokit } from "@/core/github/shared";
import { getDeps } from "@/deps";

interface Commenter {
  count: number;
  name: string;
  htmlUrl: string;
  avatarUrl: string;
}

// Specialized query that only fetches reactions and comments data
function getIssueReactionsAndCommentersQuery() {
  const query = graphql(`
    query getReactionsAndCommenters(
      $organization: String!
      $repo: String!
      $cursor: String
    ) {
      repository(owner: $organization, name: $repo) {
        issues(
          first: 100
          orderBy: { field: UPDATED_AT, direction: ASC }
          after: $cursor
        ) {
          nodes {
            id
            updatedAt
            reactionGroups {
              content
              reactors {
                totalCount
              }
            }
            comments(first: 100) {
              nodes {
                author {
                  login
                  url
                  avatarUrl
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `);
  return print(query);
}

const githubAuthorSchema = z.object({
  login: z.string(),
  url: z.string(),
  avatarUrl: z.string(),
});

const githubCommentSchema = z.object({
  author: githubAuthorSchema.nullable(),
});

const githubReactionGroupSchema = z.object({
  content: z.string(),
  reactors: z.object({
    totalCount: z.number(),
  }),
});

const githubIssueSchema = z.object({
  id: z.string(),
  updatedAt: z.string(),
  reactionGroups: z.array(githubReactionGroupSchema),
  comments: z.object({
    nodes: z.array(githubCommentSchema),
  }),
});

const githubResponseSchema = z.object({
  repository: z.object({
    issues: z.object({
      nodes: z.array(githubIssueSchema),
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        endCursor: z.string().nullable(),
      }),
    }),
  }),
});

type GithubComment = z.infer<typeof githubCommentSchema>;

async function getIssueReactionsAndCommenters({
  repoOwner,
  repoName,
  cursor,
  octokit,
}: {
  repoOwner: string;
  repoName: string;
  cursor: string | null;
  octokit: GraphqlOctokit;
}) {
  const response = await octokit.graphql(
    getIssueReactionsAndCommentersQuery(),
    {
      organization: repoOwner,
      repo: repoName,
      cursor,
    },
  );

  const parsedResponse = githubResponseSchema.parse(response);

  const issues = parsedResponse.repository.issues.nodes.map((issue) => {
    // Aggregate reactions
    const reactionCounts = issue.reactionGroups.reduce(
      (acc: Record<string, number>, reaction) => {
        acc[reaction.content] = reaction.reactors.totalCount;
        return acc;
      },
      {},
    );

    const aggregateReactions: AggregateReactions = {
      THUMBS_UP: reactionCounts.THUMBS_UP || 0,
      THUMBS_DOWN: reactionCounts.THUMBS_DOWN || 0,
      LAUGH: reactionCounts.LAUGH || 0,
      HOORAY: reactionCounts.HOORAY || 0,
      CONFUSED: reactionCounts.CONFUSED || 0,
      HEART: reactionCounts.HEART || 0,
      ROCKET: reactionCounts.ROCKET || 0,
      EYES: reactionCounts.EYES || 0,
    };

    // Get top 5 commenters
    const commentFrequency = issue.comments.nodes
      .filter(
        (
          comment,
        ): comment is GithubComment & {
          author: NonNullable<typeof comment.author>;
        } => comment.author != null,
      )
      .reduce((acc: Map<string, Commenter>, comment) => {
        const author = comment.author;
        const key = author.login;
        if (!acc.has(key)) {
          acc.set(key, {
            count: 0,
            name: author.login,
            htmlUrl: author.url,
            avatarUrl: author.avatarUrl,
          });
        }
        const commenter = acc.get(key)!;
        commenter.count++;
        return acc;
      }, new Map<string, Commenter>());

    const topCommenters = Array.from(commentFrequency.values())
      .sort((a: Commenter, b: Commenter) => b.count - a.count)
      .slice(0, 5)
      .map(({ name, htmlUrl, avatarUrl }) => ({
        name,
        htmlUrl,
        avatarUrl,
      }));

    return {
      nodeId: issue.id,
      updatedAt: new Date(issue.updatedAt),
      aggregateReactions: Object.values(aggregateReactions).some(
        (count) => count > 0,
      )
        ? aggregateReactions
        : null,
      topCommenters: topCommenters.length > 0 ? topCommenters : null,
    };
  });

  return {
    issues,
    hasNextPage: parsedResponse.repository.issues.pageInfo.hasNextPage,
    endCursor: parsedResponse.repository.issues.pageInfo.endCursor,
  };
}

interface Progress {
  repoId: string;
  cursor: string | null;
  lastProcessedUpdatedAt: string | null;
}

async function main() {
  const { db, graphqlOctokit: octokit } = await getDeps();

  // Get all repos that have completed initialization
  const reposToUpdate = await db
    .select({
      id: repos.id,
      name: repos.name,
      ownerLogin: repos.ownerLogin,
    })
    .from(repos)
    .where(
      and(
        eq(repos.initStatus, "completed"),
        lt(repos.createdAt, new Date("2025-01-07 08:02:51.612571+00")),
      ),
    );

  console.log(`Found ${reposToUpdate.length} repos to backfill`);

  // Save progress to allow interruption and resumption
  const progressFile = "backfill-progress.json";
  let progress: Progress;
  try {
    progress = JSON.parse(await fs.readFile(progressFile, "utf-8"));
    console.log("Resuming from previous progress");
  } catch {
    progress = {
      repoId: reposToUpdate[0]!.id,
      cursor: null,
      lastProcessedUpdatedAt: null,
    };
  }

  // Find the index of the repo we need to continue from
  let startIndex = reposToUpdate.findIndex(
    (repo) => repo.id === progress.repoId,
  );
  if (startIndex === -1) {
    console.log(
      "Could not find repo from progress file, starting from beginning",
    );
    startIndex = 0;
    progress = {
      repoId: reposToUpdate[0]!.id,
      cursor: null,
      lastProcessedUpdatedAt: null,
    };
  }

  for (let i = startIndex; i < reposToUpdate.length; i++) {
    const repo = reposToUpdate[i]!;
    console.log(`Processing repo: ${repo.ownerLogin}/${repo.name}`);

    // Reset cursor and lastProcessedUpdatedAt when moving to a new repo
    if (repo.id !== progress.repoId) {
      progress.repoId = repo.id;
      progress.cursor = null;
      progress.lastProcessedUpdatedAt = null;
    }
    let cursor = progress.cursor;
    let hasMore = true;

    while (hasMore) {
      try {
        // Accumulate 500 issues before processing
        let accumulatedIssues: any[] = [];
        let batchEndCursor: string | null = cursor;
        let shouldContinue = true;

        for (
          let batchCount = 0;
          batchCount < 5 && shouldContinue;
          batchCount++
        ) {
          console.log(
            `Fetching batch ${batchCount + 1}/5 with cursor: ${batchEndCursor}`,
          );

          const { issues, hasNextPage, endCursor } =
            await getIssueReactionsAndCommenters({
              repoOwner: repo.ownerLogin,
              repoName: repo.name,
              cursor: batchEndCursor,
              octokit,
            });

          if (issues.length === 0) {
            shouldContinue = false;
            hasMore = false;
          }

          // Check if we've found an issue that already has reactions/commenters
          const lastUpdatedAt = issues[issues.length - 1]!.updatedAt;
          const [existingIssue] = await db
            .select({
              nodeId: issueTable.nodeId,
            })
            .from(issueTable)
            .where(
              and(
                eq(issueTable.repoId, repo.id),
                eq(issueTable.issueUpdatedAt, lastUpdatedAt),
                and(
                  not(isNull(issueTable.aggregateReactions)),
                  not(isNull(issueTable.topCommenters)),
                ),
              ),
            )
            .limit(1);

          if (existingIssue) {
            console.log("Found issue with existing data, moving to next repo");
            shouldContinue = false;
            hasMore = false;
          }

          accumulatedIssues = [...accumulatedIssues, ...issues];
          batchEndCursor = endCursor;
          shouldContinue = hasNextPage;
        }

        if (accumulatedIssues.length === 0) {
          hasMore = false;
          continue;
        }

        // Process accumulated issues in parallel with concurrency of 20
        console.log(
          `Processing ${accumulatedIssues.length} issues in parallel`,
        );
        await pMap(
          accumulatedIssues,
          async (issue) => {
            await db
              .update(issueTable)
              .set({
                aggregateReactions: issue.aggregateReactions,
                topCommenters: issue.topCommenters,
              })
              .where(eq(issueTable.nodeId, issue.nodeId));
          },
          { concurrency: 20 },
        );

        console.log(`Updated ${accumulatedIssues.length} issues in parallel`);

        // Save progress after processing the accumulated batch
        const lastProcessedIssue =
          accumulatedIssues[accumulatedIssues.length - 1]!;
        progress = {
          repoId: repo.id,
          cursor: batchEndCursor,
          lastProcessedUpdatedAt: lastProcessedIssue.updatedAt.toISOString(),
        };
        await fs.writeFile(progressFile, JSON.stringify(progress));

        cursor = batchEndCursor;

        // Now we can safely break if we need to move to next repo
        if (!shouldContinue) {
          break;
        }
      } catch (error) {
        console.error("Error processing batch:", error);
        // Save progress before exiting
        await fs.writeFile(progressFile, JSON.stringify(progress));
        process.exit(1);
      }
    }
  }

  console.log("Backfill complete!");
  // Clean up progress file
  await fs.unlink(progressFile);
  process.exit(0);
}

main().catch((error) => {
  console.error("Error during backfill:", error);
  process.exit(1);
});
