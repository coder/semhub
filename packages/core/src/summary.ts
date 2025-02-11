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
    temperature = 0.2,
    reasoningEffort = "high",
  }: {
    textToSummarize: string;
    systemPrompt: string;
    userInstructions: string;
    temperature?: number;
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
    temperature,
    reasoning_effort: reasoningEffort,
  });
  const result = chatCompletionSchema.parse(response);
  return result.choices[0]!.message.content;
}

// Predefined prompts and instructions
const PROMPTS = {
  issueBody: {
    system:
      "You are a helpful assistant that generates concise summaries of GitHub issue descriptions. Focus on the problem, proposed solutions, and key technical details.",
    user: "Please summarize this GitHub issue description:",
  },
  comments: {
    system:
      "You are a helpful assistant that generates concise summaries of GitHub issue comments. Focus on key decisions, solutions proposed, and final outcomes.",
    user: "Please summarize the discussion in these GitHub issue comments:",
  },
  overall: {
    system:
      "You are a helpful assistant that generates concise overall summaries of GitHub issues. Synthesize the issue description and discussion into a clear summary.",
    user: "Please provide a concise overall summary of this GitHub issue based on these summaries:",
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
    commentsSummary?: string;
    issue: SelectIssueForEmbedding;
  },
  openai: OpenAIClient,
): Promise<string> {
  const {
    number,
    title,
    author,
    issueState: state,
    issueStateReason: stateReason,
    issueCreatedAt: createdAt,
    issueClosedAt: closedAt,
    labels,
  } = params.issue;

  const text = dedent`
    Issue #${number}: ${title}

    Description Summary:
    ${params.bodySummary}

    Discussion Summary:
    ${params.commentsSummary || "No discussion"}

    Additional Context:
    - State: ${state}${stateReason ? `, Reason: ${stateReason}` : ""}
    - Author: ${author?.name || "Anonymous"}
    - Created: ${createdAt.toISOString()}${closedAt ? `\n- Closed: ${closedAt.toISOString()}` : ""}
    ${labels?.length ? `- Labels: ${labels.map((label) => `${label.name}${label.description ? ` (${label.description})` : ""}`).join(", ")}` : ""}`;

  return await summarize(
    {
      textToSummarize: text,
      systemPrompt: PROMPTS.overall.system,
      userInstructions: PROMPTS.overall.user,
      temperature: 0.3,
    },
    openai,
  );
}

interface IssueSummary {
  issueId: string;
  bodySummary?: string | null;
  commentsSummary?: string | null;
  overallSummary?: string | null;
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
      sql`when id = ${summary.issueId} then ${summary.commentsSummary}`,
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
