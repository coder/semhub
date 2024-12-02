import OpenAI from "openai";

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({
    apiKey,
  });
}

export type OpenAIClient = ReturnType<typeof createOpenAIClient>;
