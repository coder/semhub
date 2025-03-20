export class ReducePromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIReducePromptError";
  }
}

export function isReducePromptError(
  error: unknown,
): error is ReducePromptError {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("please reduce your prompt")
  );
}
