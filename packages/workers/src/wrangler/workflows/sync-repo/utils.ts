export type WorkflowWithTypedParams<T> = Omit<Workflow, "create"> & {
  create(
    options?: Omit<WorkflowInstanceCreateOptions, "params"> & { params?: T },
  ): Promise<WorkflowInstance>;
};

/**
 * Generates a unique workflow ID based on the current 10-minute time window
 * In the same 10-minute window, identical IDs will be generated
 * @returns A string ID in format "sync-{timestamp}"
 */
export function generateSyncWorkflowId(): string {
  const tenMinutesInMs = 10 * 60 * 1000;
  return `sync-${Math.floor(Date.now() / tenMinutesInMs) * tenMinutesInMs}`;
}
