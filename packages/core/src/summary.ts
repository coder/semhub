import type { OpenAIClient } from "./openai";
import { SUMMARY_MODEL } from "./openai";
import { chatCompletionSchema } from "./openai/schema";

async function summarize(
  {
    textToSummarize,
    systemPrompt,
    userInstructions,
    temperature = 0.2,
    reasoningEffort = "medium",
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
      temperature: 0.2,
      reasoningEffort: "high",
    },
    openai,
  );
}

export async function generateCommentsSummary(
  comments: Array<{ body: string }>,
  openai: OpenAIClient,
): Promise<string> {
  if (!comments.length) {
    return "";
  }

  return await summarize(
    {
      textToSummarize: comments.map((c) => c.body).join("\n\n"),
      systemPrompt: PROMPTS.comments.system,
      userInstructions: PROMPTS.comments.user,
      temperature: 0.3,
    },
    openai,
  );
}

export async function generateOverallSummary(
  params: {
    bodySummary: string;
    commentsSummary?: string;
  },
  openai: OpenAIClient,
): Promise<string> {
  const text = `Issue description summary:
${params.bodySummary}

Discussion summary:
${params.commentsSummary || "No discussion"}`;

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

// Export for testing or custom usage
export { summarize, PROMPTS };
