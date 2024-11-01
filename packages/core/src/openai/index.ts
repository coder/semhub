import OpenAI from "openai";
import { Resource } from "sst";

export function getOpenAIClient() {
  return new OpenAI({
    apiKey: Resource.OPENAI_API_KEY.value,
  });
}
