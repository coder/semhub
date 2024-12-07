export class WorkersSizeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkersSizeLimitError";
  }
}

export function isWorkersSizeLimitError(
  error: unknown,
): error is WorkersSizeLimitError {
  return (
    error instanceof Error &&
    error.message.includes(
      "Serialized RPC arguments or return values are limited to 1MiB",
    )
  );
}
