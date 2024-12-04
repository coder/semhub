// cannot send WorkflowInstance over RPC, so must write substitute methods
// be careful: if you send a non-string payload, it will be serialized to string and lose its methods
export interface WorkflowRPC<T = unknown, E = unknown> {
  fetch(request: Request, env?: E): Promise<Response>;
  create(
    options?: Omit<WorkflowInstanceCreateOptions, "params"> & { params?: T },
    env?: E,
  ): Promise<WorkflowInstance["id"]>;
  terminate(id: string, env?: E): Promise<void>;
  getInstanceStatus(id: string, env?: E): Promise<InstanceStatus>;
}

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

export function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
    array.slice(index * size, (index + 1) * size),
  );
}
