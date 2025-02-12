import dedent from "dedent";

import { inArray, sql } from "./db";
import type { DbClient } from "./db";
import type { SelectIssueForEmbedding } from "./db/schema/entities/issue.schema";
import { issueTable } from "./db/schema/entities/issue.sql";
import type { Author } from "./db/schema/shared";
import type { OpenAIClient } from "./openai";
import { SUMMARY_MODEL } from "./openai";
import { chatCompletionSchema } from "./openai/schema";

async function summarize(
  {
    textToSummarize,
    systemPrompt,
    userInstructions,
    reasoningEffort = "high",
  }: {
    textToSummarize: string;
    systemPrompt: string;
    userInstructions: string;
    reasoningEffort?: "low" | "medium" | "high";
  },
  openai: OpenAIClient,
): Promise<string> {
  const messages = [
    {
      role: "system" as const,
      content: systemPrompt,
    },
    {
      role: "user" as const,
      content: `${userInstructions}\n\n${textToSummarize}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: SUMMARY_MODEL,
    messages,
    reasoning_effort: reasoningEffort,
  });
  const result = chatCompletionSchema.parse(response);
  return result.choices[0]!.message.content;
}

// Predefined prompts and instructions
const PROMPTS = {
  issueBody: {
    system:
      "You are a helpful assistant that generates concise summaries of GitHub issue descriptions. Describe the issue directly and focus on the problem, proposed solutions, and key technical details.",
    user: "Please summarize this GitHub issue description in no more than 3 short paragraphs. Just provide the summary directly.",
  },
  comments: {
    system:
      "You are a helpful assistant that generates concise summaries of GitHub issue comments. Summarise the comments so that a human can capture the main points of discussion without reading the entire comment thread. If you include the name of the author, make sure to stick to the original casing and don't modify it.",
    user: "Please summarize the discussion in these GitHub issue comments in no more than 3 short paragraphs. Just provide the summary directly.",
  },
  overall: {
    system:
      "You are a helpful assistant that generates concise overall summaries of GitHub issues so that a human can understand the issue at a glance. You will be provided with information of the issue, a summary of of the issue body and a summary of the comments, and additional context. Don't use 'this issue' or 'this discussion', just provide the summary directly.",
    user: "Please provide a direct summary of this issue based on the provided information in a single paragraph no more than 5 sentences.",
  },
} as const;

export async function generateBodySummary(
  body: string,
  openai: OpenAIClient,
): Promise<string> {
  return await summarize(
    {
      textToSummarize: body,
      systemPrompt: PROMPTS.issueBody.system,
      userInstructions: PROMPTS.issueBody.user,
    },
    openai,
  );
}

export async function generateCommentsSummary(
  comments: Array<{ body: string; author: Author }>,
  openai: OpenAIClient,
): Promise<string> {
  if (!comments.length) {
    return "";
  }

  return await summarize(
    {
      textToSummarize: comments
        .map((c) => {
          const authorName = c.author?.name || "Deleted User";
          return dedent`
            ${authorName} wrote:
            ${c.body}`;
        })
        .join("\n\n---\n\n"),
      systemPrompt: PROMPTS.comments.system,
      userInstructions: PROMPTS.comments.user,
    },
    openai,
  );
}

export async function generateOverallSummary(
  params: {
    bodySummary: string;
    commentsSummary: string | null;
    issue: SelectIssueForEmbedding;
  },
  openai: OpenAIClient,
): Promise<string> {
  const {
    title,
    author,
    issueState: state,
    issueStateReason: stateReason,
    issueCreatedAt: createdAt,
    issueClosedAt: closedAt,
    labels,
    aggregateReactions,
  } = params.issue;

  // Transform aggregate reactions into a human-readable string
  // Format: "thumbs up (5), heart (3)" for reactions with count > 0
  const reactionsSummary = aggregateReactions
    ? Object.entries(aggregateReactions)
        // Only include reactions that have been used
        .filter(([, count]) => count > 0)
        // Format each reaction as "reaction_name (count)"
        .map(
          ([reaction, count]) =>
            `${reaction.toLowerCase().replace("_", " ")} (${count})`,
        )
        // Join all reactions with commas
        .join(", ")
    : "";

  // Transform labels into a human-readable string
  // Format: "bug (needs triage), feature (high priority)"
  const labelsSummary = labels?.length
    ? labels
        .map(
          (label) =>
            `${label.name}${label.description ? ` (${label.description})` : ""}`,
        )
        .join(", ")
    : "";

  const text = dedent`
    Issue: ${title}

    Description Summary:
    ${params.bodySummary}

    ${params.commentsSummary ? `Comments Summary: ${params.commentsSummary}\n` : ""}
    Additional Context:
    - State: ${state}${stateReason ? `, Reason: ${stateReason}` : ""}
    - Author: ${author?.name || "Deleted User"}
    - Created: ${createdAt.toISOString()}${closedAt ? `\n- Closed: ${closedAt.toISOString()}` : ""}
    ${labelsSummary ? `- Labels: ${labelsSummary}` : ""}
    ${reactionsSummary ? `- Reactions: ${reactionsSummary}` : ""}`;

  return await summarize(
    {
      textToSummarize: text,
      systemPrompt: PROMPTS.overall.system,
      userInstructions: PROMPTS.overall.user,
    },
    openai,
  );
}

export interface IssueSummary {
  issueId: string;
  bodySummary: string;
  commentsSummary: string | null;
  overallSummary: string;
}

export async function bulkUpdateIssueSummaries(
  summaries: IssueSummary[],
  db: DbClient,
): Promise<void> {
  if (summaries.length === 0) return;

  const sqlChunks = {
    bodySummary: [sql`(case`],
    commentsSummary: [sql`(case`],
    overallSummary: [sql`(case`],
  };

  const issueIds = summaries.map((s) => s.issueId);

  for (const summary of summaries) {
    sqlChunks.bodySummary.push(
      sql`when id = ${summary.issueId} then ${summary.bodySummary}`,
    );
    sqlChunks.commentsSummary.push(
      sql`when id = ${summary.issueId} then ${summary.commentsSummary === null ? sql`null` : summary.commentsSummary}`,
    );
    sqlChunks.overallSummary.push(
      sql`when id = ${summary.issueId} then ${summary.overallSummary}`,
    );
  }

  for (const key of Object.keys(sqlChunks) as Array<keyof typeof sqlChunks>) {
    sqlChunks[key].push(sql`end)`);
  }

  await db
    .update(issueTable)
    .set({
      bodySummary: sql.join(sqlChunks.bodySummary, sql.raw(" ")),
      commentsSummary: sql.join(sqlChunks.commentsSummary, sql.raw(" ")),
      overallSummary: sql.join(sqlChunks.overallSummary, sql.raw(" ")),
    })
    .where(inArray(issueTable.id, issueIds));
}

// Export for testing or custom usage
export { summarize, PROMPTS };
