// params sent over RPC will be converted to string
type ParamsRPC = string | { [key: string]: ParamsRPC } | ParamsRPC[];
// cannot send classes with methods (?) over RPC, so must write substitute methods
export interface WorkflowRPC<T extends ParamsRPC = ParamsRPC, E = unknown> {
  fetch(request: Request, env?: E): Promise<Response>;
  create(
    options?: Omit<WorkflowInstanceCreateOptions, "params"> & { params?: T },
    env?: E,
  ): Promise<WorkflowInstance["id"]>;
  terminate(id: string, env?: E): Promise<void>;
  getInstanceStatus(id: string, env?: E): Promise<InstanceStatus>;
}

// not actually accurate, be careful
export function getApproximateSizeInBytes(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/**
 * Sanitizes the prefix to match the required pattern
 * Replaces invalid characters and ensures valid start character
 */
export function sanitizePrefix(prefix: string): string {
  // If empty or undefined, return a default
  if (!prefix) return "workflow";

  // Replace any characters that aren't alphanumeric, hyphen, or underscore
  let sanitized = prefix.replace(/[^a-zA-Z0-9-_]/g, "");

  // Ensure first character is alphanumeric or underscore (not hyphen)
  if (!/^[a-zA-Z0-9_]/.test(sanitized)) {
    sanitized = `w${sanitized}`;
  }
  if (sanitized.length > 20) {
    sanitized = sanitized.substring(0, 20);
  }

  return sanitized;
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
 * Generates a unique workflow ID based on the time window size
 * @returns A string ID in format "{prefix}-{timestamp}"
 */
export function generateWorkflowId({
  prefix,
  windowSizeInMs = 1,
}: {
  prefix: string;
  windowSizeInMs?: number;
}): string {
  const sanitizedPrefix = sanitizePrefix(prefix);
  const workflowId = `${sanitizedPrefix}-${getCurrentWindowTimestamp(
    windowSizeInMs,
  )}`;
  if (workflowId.length > 64) {
    throw new Error(
      `Workflow ID ${workflowId} is too long. Maximum length is 64 characters.`,
    );
  }
  return workflowId;
}
