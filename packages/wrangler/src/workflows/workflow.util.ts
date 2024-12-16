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
  let sanitized = prefix.replace(/[^a-zA-Z0-9-_]/g, "_");

  // Ensure first character is alphanumeric or underscore (not hyphen)
  if (!/^[a-zA-Z0-9_]/.test(sanitized)) {
    sanitized = `w${sanitized}`;
  }

  return sanitized;
}
