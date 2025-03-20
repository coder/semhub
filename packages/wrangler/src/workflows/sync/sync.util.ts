import { generateWorkflowId } from "../workflow.util";

export function generateSyncWorkflowId(
  prefix: string,
  windowSizeInMs = 1,
): string {
  return generateWorkflowId({
    prefix: `sync-${prefix}`,
    windowSizeInMs,
  });
}
