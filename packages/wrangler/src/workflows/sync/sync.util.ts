/**
 * Calculates the timestamp for the current time window
 * @param windowSizeInMs The size of the time window in milliseconds
 * @returns Timestamp in milliseconds, rounded down to the nearest window
 */
export function getCurrentWindowTimestamp(windowSizeInMs: number): number {
  return Math.floor(Date.now() / windowSizeInMs) * windowSizeInMs;
}

/**
 * Generates a unique workflow ID based on the time window size
 * @returns A string ID in format "{prefix}-{timestamp}"
 */
export function generateSyncWorkflowId(
  prefix: string,
  windowSizeInMs = 1,
): string {
  return `${prefix}-${getCurrentWindowTimestamp(windowSizeInMs)}`;
}
