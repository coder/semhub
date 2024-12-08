/**
 * Calculates the timestamp for the current time window
 * @param windowSizeInMs The size of the time window in milliseconds
 * @returns Timestamp in milliseconds, rounded down to the nearest window
 */
export function getCurrentWindowTimestamp(windowSizeInMs: number): number {
  return Math.floor(Date.now() / windowSizeInMs) * windowSizeInMs;
}

/**
 * Generates a unique workflow ID based on the current 10-minute time window
 * In the same 10-minute window, identical IDs will be generated
 * @returns A string ID in format "cron-sync-{timestamp}"
 */
export function generateCronSyncWorkflowId(): string {
  const tenMinutesInMs = 10 * 60 * 1000;
  return `cron-sync-${getCurrentWindowTimestamp(tenMinutesInMs)}`;
}
