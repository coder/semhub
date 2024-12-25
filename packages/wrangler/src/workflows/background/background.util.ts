import { generateWorkflowId } from "../workflow.util";

export function generateBackgroundWorkflowId(
  prefix: string,
  windowSizeInMs = 1,
): string {
  return generateWorkflowId({
    prefix: `background-${prefix}`,
    windowSizeInMs,
  });
}
